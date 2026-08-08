<?php
/**
 * Ask the photo library what it is willing to sell, and build the catalogue from the answer.
 *
 * The seeder originally went the other way: write a shop, then go looking for pictures of it. That
 * fails against a stock library, because a stock library is lifestyle-first. Measured across the
 * general store, only a third of searches returned even one product-style shot in their top ten:
 * search "skillet" and the photographs are of the food cooked in one, "crew jumper" and you get a
 * dog wearing one.
 *
 * Inverting it removes the mismatch entirely. Probe a long list of candidate nouns, keep the ones
 * the library really does photograph on their own, and let a theme be written from the survivors.
 * A shop of things that photograph well is a perfectly good demo shop; a shop of things that do
 * not is a screenshot full of gradient tiles.
 *
 *   php tools/prospect-stock.php                    # probe the built-in candidate list
 *   php tools/prospect-stock.php --words=a,b,c      # probe specific words
 *   php tools/prospect-stock.php --min=3            # how many product shots a word must have
 *
 * Costs one API request per word not already cached, against a 200-an-hour cap, and stops cleanly
 * when the library says enough. Everything it learns is cached, so a second pass is free.
 */

require __DIR__.'/demo-images-stock.php';

$opts = getopt('', ['words::', 'min::', 'limit::', 'help']);
if (isset($opts['help'])) {
	fwrite(STDERR, "usage: php tools/prospect-stock.php [--words=a,b,c] [--min=2] [--limit=200]\n");
	exit(0);
}

function apiKey(string $env, string $name): string
{
	$fromEnv = (string)(getenv($env) ?: '');
	if ($fromEnv !== '') return $fromEnv;
	$file = __DIR__.'/.keys/'.$name;
	return is_readable($file) ? trim((string)file_get_contents($file)) : '';
}

$key = apiKey('PEXELS_API_KEY', 'pexels');
if ($key === '') {
	fwrite(STDERR, "no Pexels key; run: php tools/set-api-key.php pexels\n");
	exit(1);
}

/**
 * Candidates, deliberately wide.
 *
 * The point is not that these are good products; it is to find out which of them the library
 * photographs on their own. Most will fail, and that is the information being bought.
 */
$candidates = [
	// Homeware and kitchen, the small hard-edged things rather than cookware
	'mug', 'teapot', 'ceramic vase', 'candle', 'scented candle', 'glass jar', 'wooden bowl',
	'cutting board', 'french press', 'coffee grinder', 'tea infuser', 'water carafe',
	'wine glass', 'cocktail shaker', 'salt shaker', 'ceramic plate', 'espresso cup',
	'thermos flask', 'lunch box', 'picnic basket', 'wicker basket', 'storage box',
	// Light, decoration, textiles
	'table lamp', 'desk lamp', 'picture frame', 'wall clock', 'alarm clock', 'mirror',
	'cushion', 'blanket', 'towel', 'bath towel', 'doormat', 'plant pot', 'terracotta pot',
	'incense', 'diffuser', 'wall art', 'poster',
	// Stationery and desk
	'notebook', 'sketchbook', 'fountain pen', 'ballpoint pen', 'pencil', 'colored pencils',
	'eraser', 'stapler', 'scissors', 'ruler', 'paper clips', 'sticky notes', 'envelope',
	'greeting card', 'calendar', 'planner', 'bookmark', 'desk organizer',
	// Bags, accessories, fashion adjacent
	'backpack', 'leather bag', 'tote bag', 'wallet', 'purse', 'belt', 'sunglasses', 'watch',
	'wristwatch', 'hat', 'cap', 'gloves', 'socks', 'sneakers', 'boots', 'sandals', 'scarf',
	'tie', 'umbrella', 'keychain', 'luggage', 'suitcase',
	// Jewellery, which stock photographs obsessively
	'necklace', 'bracelet', 'earrings', 'ring', 'pendant', 'brooch',
	// Beauty and care, likewise
	'perfume bottle', 'soap bar', 'lip balm', 'face cream', 'shampoo bottle', 'hairbrush',
	'razor', 'nail polish', 'makeup brush', 'cosmetic jar', 'essential oil',
	// Tech and audio
	'headphones', 'earbuds', 'bluetooth speaker', 'keyboard', 'computer mouse', 'webcam',
	'power bank', 'usb cable', 'phone case', 'tripod', 'camera', 'film camera', 'vinyl record',
	'record player', 'radio',
	// Outdoor and sport
	'water bottle', 'yoga mat', 'dumbbell', 'jump rope', 'tennis ball', 'football',
	'skateboard', 'bicycle helmet', 'compass', 'binoculars', 'flashlight', 'pocket knife',
	'thermos', 'hammock', 'tent',
	// Food and drink, packaged rather than plated
	'coffee beans', 'ground coffee', 'tea leaves', 'honey jar', 'olive oil bottle',
	'chocolate bar', 'spice jar', 'wine bottle', 'jam jar',
	// Musical and hobby
	'ukulele', 'harmonica', 'chess set', 'playing cards', 'dice', 'jigsaw puzzle',
	'paint brushes', 'watercolor set', 'knitting yarn', 'sewing kit',
];

if (is_string($opts['words'] ?? null) && $opts['words'] !== '') {
	$candidates = array_values(array_filter(array_map('trim', explode(',', $opts['words']))));
}
$min = max(1, (int)($opts['min'] ?? 2));
$limit = max(1, (int)($opts['limit'] ?? 200));
$candidates = array_slice($candidates, 0, $limit);

/**
 * Is this photograph OF the thing, rather than a scene containing it?
 *
 * Read from the description, which is the only thing there is to read. Three tests, and a photo
 * has to pass all of them: it must mention the thing, it must not be about a person, and it must
 * look like a photograph taken of an object -- on a plain ground, or from directly above, or close
 * enough that the object fills the frame.
 */
function isProductShot(string $alt, string $word): bool
{
	$alt = strtolower($alt);
	if ($alt === '') return false;

	// The noun itself. The last word of "scented candle" is the thing; the rest qualifies it.
	$parts = preg_split('/\s+/', strtolower($word), -1, PREG_SPLIT_NO_EMPTY);
	$noun = end($parts);
	// Tolerate a plural, which is how descriptions usually put it.
	if (!str_contains($alt, $noun) && !str_contains($alt, rtrim($noun, 's'))) return false;

	foreach (['man', 'woman', 'women', 'men', 'person', 'people', 'girl', 'boy', 'lady', 'child',
		'friends', 'couple', 'portrait', 'model', 'wearing', 'holding', 'posing', 'hands', 'hand',
		'she ', 'he ', 'her ', 'his '] as $who) {
		if (preg_match('/\b'.preg_quote(trim($who), '/').'\b/', $alt)) return false;
	}

	foreach (['white background', 'plain background', 'on a white', 'isolated', 'studio',
		'close-up', 'close up', 'top view', 'flat lay', 'overhead', 'still life', 'minimalist',
		'against a', 'on a table', 'on a wooden', 'product'] as $how) {
		if (str_contains($alt, $how)) return true;
	}
	return false;
}

$stock = new DemoImagesStock($key, __DIR__.'/cache/stock');
if (!$stock->reachable()) {
	fwrite(STDERR, "Pexels did not accept the stored key\n");
	exit(1);
}

$results = [];
foreach ($candidates as $word) {
	$photos = $stock->photosFor($word);
	if ($stock->isLimited()) {
		fwrite(STDERR, "\nstopped: ".$stock->quotaLine()."\n");
		fwrite(STDERR, "what was probed is cached, so re-running continues rather than restarting\n");
		break;
	}
	$good = [];
	foreach ($photos as $photo) {
		if (isProductShot((string)($photo['alt'] ?? ''), $word)) $good[] = $photo;
	}
	$results[$word] = ['total' => count($photos), 'good' => $good];
	printf("%-22s %2d of %2d %s\n", $word, count($good), count($photos),
		count($good) >= $min ? '  keep' : '');
}

$keep = array_filter($results, fn($r) => count($r['good']) >= $min);
uasort($keep, fn($a, $b) => count($b['good']) <=> count($a['good']));

echo "\n".str_repeat('-', 70)."\n";
printf("probed %d words, %d have at least %d product shots (%.0f%%)\n",
	count($results), count($keep), $min, 100 * count($keep) / max(1, count($results)));
$quota = $stock->quotaLine();
if ($quota !== null) echo $quota."\n";

// The winners, with what the best photograph of each actually shows, so the list can be judged
// rather than trusted.
echo "\nusable, best first:\n";
foreach ($keep as $word => $r) {
	printf("  %-22s %d  %s\n", $word, count($r['good']),
		mb_strimwidth((string)($r['good'][0]['alt'] ?? ''), 0, 70, '…'));
}

$out = __DIR__.'/cache/prospect.json';
@file_put_contents($out, json_encode(array_map(fn($r) => count($r['good']), $keep), JSON_PRETTY_PRINT));
echo "\nkept words written to $out\n";
