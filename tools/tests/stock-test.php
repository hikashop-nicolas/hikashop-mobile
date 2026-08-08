<?php
require __DIR__.'/../demo-images-stock.php';

$base = 'http://127.0.0.1:8099';
$cache = sys_get_temp_dir().'/stock-test-cache';
@array_map('unlink', glob($cache.'/*') ?: []);
@unlink(sys_get_temp_dir().'/fake-pexels-count');

$fail = 0;
function check(string $what, bool $ok) { global $fail; if (!$ok) $fail++; printf("%-62s %s\n", $what, $ok ? 'ok' : 'FAIL'); }
function searchesMade(): int { return (int)file_get_contents('http://127.0.0.1:8099/count'); }

$stock = new DemoImagesStock('key', $cache, 10, $base.'/v1/search');

// --- the happy path, and that a whole thing costs exactly one search -------------------------
$a = $stock->imageFor('Boots', 'Chelsea Boot', null, 'front');
$b = $stock->imageFor('Boots', 'Chelsea Boot', null, 'three-quarter view');
$c = $stock->imageFor('Boots', 'Chelsea Boot', null, 'detail');
check('three views of one thing all return bytes', $a !== null && $b !== null && $c !== null);
check('three views of one thing cost one search', searchesMade() === 1);
check('the three views are three different photographs',
	count(array_unique([md5((string)$a), md5((string)$b), md5((string)$c)])) === 3);

// --- a colour is declined, so variants fall through to the model -------------------------------
$before = searchesMade();
check('a colour returns null', $stock->imageFor('Boots', 'Chelsea Boot', 'Oxblood') === null);
check('a colour spends no request', searchesMade() === $before);

// --- the disk cache: a brand new client must not re-search ------------------------------------
$fresh = new DemoImagesStock('key', $cache, 10, $base.'/v1/search');
$before = searchesMade();
$again = $fresh->imageFor('Boots', 'Chelsea Boot', null, 'front');
check('a second run returns the same picture', $again !== null && md5((string)$again) === md5((string)$a));
check('a second run spends no request at all', searchesMade() === $before);

// --- images cleared but searches kept: still no request ---------------------------------------
@array_map('unlink', glob($cache.'/*.jpg') ?: []);
$third = new DemoImagesStock('key', $cache, 10, $base.'/v1/search');
$before = searchesMade();
check('re-downloading a cleared image works', $third->imageFor('Boots', 'Chelsea Boot', null, 'front') !== null);
check('re-downloading a cleared image spends no search', searchesMade() === $before);

// --- 429: the whole point ----------------------------------------------------------------------
// The fake server serves 2 searches then refuses. One is already spent, so the next new query
// succeeds and the one after that is refused.
$limited = new DemoImagesStock('key', $cache, 10, $base.'/v1/search');
$limited->imageFor('Kitchen', 'Copper Pan', null, 'front');        // spends the 2nd
$before = searchesMade();
$r1 = $limited->imageFor('Kitchen', 'Steel Whisk', null, 'front'); // refused
check('a throttled lookup returns null', $r1 === null);
check('throttling is detected', $limited->isLimited());

$after429 = searchesMade();
$limited->imageFor('Kitchen', 'Oak Board', null, 'front');
$limited->imageFor('Kitchen', 'Linen Cloth', null, 'front');
$limited->imageFor('Kitchen', 'Glass Jar', null, 'front');
check('once throttled, no further requests are spent', searchesMade() === $after429);

$quota = $limited->quotaLine();
check('the quota line names the limit', is_string($quota) && str_contains($quota, '20,000'));
// The hourly cap is what gets hit in practice, and no header describes it. The message must not
// quote the monthly rollover, which is a fortnight out and has nothing to do with the wait.
check('an hourly 429 is named as the hourly cap', is_string($quota) && str_contains($quota, '200-an-hour'));
check('an hourly 429 says it clears within the hour', is_string($quota) && str_contains($quota, 'within the hour'));
check('an hourly 429 does not quote the monthly rollover', is_string($quota) && !str_contains($quota, 'rolls over'));
echo "  quota line: $quota\n";

// --- a throttled search must not be cached as "this word has no photographs" -------------------
$recovered = new DemoImagesStock('key', $cache, 10, $base.'/v1/search');
@unlink(sys_get_temp_dir().'/fake-pexels-count');   // quota resets
check('a word refused while throttled is retried later, not remembered as empty',
	$recovered->imageFor('Kitchen', 'Steel Whisk', null, 'front') !== null);

// --- the contact sheet -------------------------------------------------------------------------
$sheet = sys_get_temp_dir().'/picks.html';
check('a contact sheet is written', $recovered->writeContactSheet($sheet));
$html = (string)@file_get_contents($sheet);
check('the contact sheet names the query behind each pick', str_contains($html, 'Steel Whisk'));
check('the contact sheet credits the photographer', str_contains($html, 'Someone'));

$creditsFile = sys_get_temp_dir().'/credits.txt';
check('a credits file is written', $recovered->writeCredits($creditsFile));
$credits = (string)@file_get_contents($creditsFile);
check('credits name the photographer and link Pexels',
	str_contains($credits, 'Photo by Someone') && str_contains($credits, 'pexels.com'));

echo $fail ? "\n$fail FAILED\n" : "\nall good\n";
exit($fail ? 1 : 0);
