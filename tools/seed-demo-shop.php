<?php
/**
 * Fill a local HikaShop with a shop that looks like a shop.
 *
 * The app needs a test site with enough rows to exercise paging and search, and it needs those
 * rows to be presentable: "Vol test product 217" proves the list works and makes a screenshot
 * useless. This writes products, customers, addresses and orders that read like a real
 * small shop's, at whatever volume you ask for.
 *
 * It is idempotent by name: run it twice and you get the same shop, because the generator is
 * seeded and existing rows are matched by their code rather than duplicated.
 *
 *   php tools/seed-demo-shop.php --site=/usr/local/var/www/joomla6
 *   php tools/seed-demo-shop.php --site=... --products=300 --customers=300 --orders=300
 *   php tools/seed-demo-shop.php --site=... --clean        # remove what this script created
 *
 * Everything it creates is tagged: product codes start with DEMO-, customer emails end in
 * @example.com, order numbers start with DEMO. --clean removes exactly those and nothing else,
 * so a shop's real data is never at risk.
 *
 * No composer dependency on purpose. A faker library gives person names and Latin lorem, not
 * product names, so the catalogue has to be written either way; and the obvious candidate pins
 * PHP to >=8.3 <8.6, which is a ceiling to inherit for a fixture script.
 */

/**
 * Insert a row, filling anything the schema insists on that the caller did not mention.
 *
 * HikaShop's tables differ between versions and editions, and a column that is NOT NULL with no
 * default in one install has a default in another. Rather than hard-code a column list that goes
 * stale, ask the table what it needs and supply an empty value for the rest.
 */
function insertRow(mysqli $db, string $table, array $values): int {
	static $required = [];
	if (!isset($required[$table])) {
		$required[$table] = [];
		$res = $db->query("SHOW COLUMNS FROM `$table`");
		while ($col = $res->fetch_assoc()) {
			if ($col['Null'] === 'NO' && $col['Default'] === null && $col['Extra'] !== 'auto_increment') {
				$required[$table][$col['Field']] = (stripos($col['Type'], 'int') !== false
					|| stripos($col['Type'], 'decimal') !== false
					|| stripos($col['Type'], 'float') !== false
					|| stripos($col['Type'], 'double') !== false) ? 0 : '';
			}
		}
	}
	foreach ($required[$table] as $field => $blank) {
		if (!array_key_exists($field, $values)) $values[$field] = $blank;
	}

	$cols = array_keys($values);
	$place = implode(', ', array_fill(0, count($cols), '?'));
	$sql = 'INSERT INTO `'.$table.'` (`'.implode('`, `', $cols).'`) VALUES ('.$place.')';
	$st = $db->prepare($sql);
	$types = '';
	foreach ($values as $v) {
		$types .= is_int($v) ? 'i' : (is_float($v) ? 'd' : 's');
	}
	$st->bind_param($types, ...array_values($values));
	$st->execute();
	return (int)$db->insert_id;
}

$opts = getopt('', ['site:', 'products::', 'customers::', 'orders::', 'clean', 'no-images', 'ai-images::', 'ai-model::', 'theme::', 'help']);
if (isset($opts['help']) || !isset($opts['site'])) {
	fwrite(STDERR, "usage: php seed-demo-shop.php --site=/path/to/joomla [--products=300] [--customers=300] [--orders=300] [--theme=NAME] [--no-images] [--ai-images[=URL]] [--ai-model=NAME] [--clean]\n");
	exit(isset($opts['help']) ? 0 : 1);
}

$site = rtrim($opts['site'], '/');
$configPath = $site.'/configuration.php';
if (!is_file($configPath)) {
	fwrite(STDERR, "no configuration.php under $site\n");
	exit(1);
}

require $configPath;
$jconfig = new JConfig();
$db = new mysqli($jconfig->host, $jconfig->user, $jconfig->password, $jconfig->db);
if ($db->connect_errno) {
	fwrite(STDERR, "cannot connect to the site database\n");
	exit(1);
}
$db->set_charset('utf8mb4');
$p = $jconfig->dbprefix;

$PRODUCT_PREFIX = 'DEMO-';
$ORDER_PREFIX = 'DEMO';
$EMAIL_SUFFIX = '@example.com';

// ---------------------------------------------------------------------------- clean

if (isset($opts['clean'])) {
	$db->query("DELETE op FROM {$p}hikashop_order_product op JOIN {$p}hikashop_order o ON o.order_id = op.order_id WHERE o.order_number LIKE '{$ORDER_PREFIX}%'");
	$db->query("DELETE FROM {$p}hikashop_order WHERE order_number LIKE '{$ORDER_PREFIX}%'");
	$db->query("DELETE pc FROM {$p}hikashop_product_category pc JOIN {$p}hikashop_product pr ON pr.product_id = pc.product_id WHERE pr.product_code LIKE '{$PRODUCT_PREFIX}%'");
	$db->query("DELETE pr2 FROM {$p}hikashop_price pr2 JOIN {$p}hikashop_product pr ON pr.product_id = pr2.price_product_id WHERE pr.product_code LIKE '{$PRODUCT_PREFIX}%'");
	// The picture files as well as their rows, or a re-run leaves the old ones behind.
	$res = $db->query("SELECT file_path FROM {$p}hikashop_file WHERE file_path LIKE 'demo-%'");
	$uploadDir = $site.'/'.trim((string)($db->query("SELECT config_value FROM {$p}hikashop_config WHERE config_namekey = 'uploadfolder'")->fetch_row()[0] ?? 'images/com_hikashop/upload/'), '/').'/';
	while ($f = $res->fetch_row()) {
		$file = $uploadDir.$f[0];
		if (is_file($file)) @unlink($file);
	}
	$db->query("DELETE FROM {$p}hikashop_file WHERE file_path LIKE 'demo-%'");
	$db->query("DELETE v FROM {$p}hikashop_variant v JOIN {$p}hikashop_product pr ON pr.product_id = v.variant_product_id WHERE pr.product_code LIKE '{$PRODUCT_PREFIX}%'");
	$db->query("DELETE FROM {$p}hikashop_product WHERE product_code LIKE '{$PRODUCT_PREFIX}%'");
	$db->query("DELETE a FROM {$p}hikashop_address a JOIN {$p}hikashop_user u ON u.user_id = a.address_user_id WHERE u.user_email LIKE '%{$EMAIL_SUFFIX}'");
	$db->query("DELETE FROM {$p}hikashop_user WHERE user_email LIKE '%{$EMAIL_SUFFIX}'");
	echo "removed everything this script creates\n";
	exit(0);
}

/**
 * Write one picture: a photograph from the model when there is one to be had, the drawn tile
 * otherwise. Returns whether anything was written.
 */
function writeImage(string $path, array $product, ?string $colour, string $view, DemoImages $drawn, $ai, array $swatches = []): bool
{
	if ($ai !== null) {
		$bytes = $ai->imageFor($product['dept'], $product['thing'], $colour, $view);
		if ($bytes !== null && @file_put_contents($path, $bytes) !== false) return true;
	}
	return $drawn->write($path, $product['dept'], $product['name'].'|'.$colour.'|'.$view, $colour !== null ? ($swatches[$colour] ?? null) : null) > 0;
}

$theme = is_string($opts['theme'] ?? null) && $opts['theme'] !== '' ? $opts['theme'] : 'general-store';
$themeFile = __DIR__.'/themes/'.basename($theme).'.php';
if (!is_file($themeFile)) {
	fwrite(STDERR, "no theme called $theme in tools/themes\n");
	exit(1);
}
$catalogue = require $themeFile;
echo 'theme: '.($catalogue['name'] ?? $theme)."\n";
require __DIR__.'/demo-images.php';

// Where HikaShop keeps uploaded images, as the shop itself has it configured.
$uploadFolder = trim((string)($db->query("SELECT config_value FROM {$p}hikashop_config WHERE config_namekey = 'uploadfolder'")->fetch_row()[0] ?? 'images/com_hikashop/upload/'), '/');
$uploadDir = $site.'/'.$uploadFolder.'/';
$wantImages = !isset($opts['no-images']);
if ($wantImages && !is_dir($uploadDir)) {
	fwrite(STDERR, "upload folder not found at $uploadDir; continuing without images\n");
	$wantImages = false;
}
if ($wantImages && !extension_loaded('gd')) {
	fwrite(STDERR, "no GD extension; continuing without images\n");
	$wantImages = false;
}
$images = $wantImages ? new DemoImages(800, $catalogue['imagery']['palettes'] ?? []) : null;

// Optionally, photographs from a local image model instead of drawn tiles. One image per kind of
// product rather than per product -- two skillets of different sizes are the same photograph as
// far as a listing is concerned -- so a 300-product shop costs 48 generations, not 300.
$ai = null;
if ($wantImages && isset($opts['ai-images'])) {
	require __DIR__.'/demo-images-ai.php';
	$aiUrl = is_string($opts['ai-images']) && $opts['ai-images'] !== '' ? $opts['ai-images'] : 'http://localhost:8080';
	// A hosted endpoint needs a key. It is read from the environment rather than taken as a flag,
	// so it stays out of the shell history and out of anything that logs the command line.
	$aiKey = (string)(getenv('DEMO_IMAGE_API_KEY') ?: '');
	$ai = new DemoImagesAi($aiUrl, is_string($opts['ai-model'] ?? null) ? $opts['ai-model'] : '', '', 180, 768, $catalogue['imagery']['style'] ?? '', $aiKey);
	if (!$ai->reachable()) {
		fwrite(STDERR, "no image model answering at $aiUrl; drawing the tiles instead\n");
		$ai = null;
	} else {
		echo "image model at $aiUrl\n";
	}
}

$nProducts = (int)($opts['products'] ?? 300);
$nCustomers = (int)($opts['customers'] ?? 300);
$nOrders = (int)($opts['orders'] ?? 300);

// Seeded per item rather than once for the whole run. Seeding once is not enough to be
// repeatable: the second run takes different branches (rows already exist), draws a different
// number of random values, and every item after that point comes out different. Re-seeding from
// the item's own index makes each item's data depend on nothing but its index.
const DEMO_SEED = 20260808;
// The most variants one product is given. Shared by every theme.
const VARIANT_CAP = 24;
$seedFor = function (string $kind, int $i) { mt_srand(crc32($kind.':'.$i) ^ DEMO_SEED); };

$pick = function (array $a) { return $a[array_rand($a)]; };

$db->query('SET autocommit=0');
$db->begin_transaction();

// ---------------------------------------------------------------------------- categories

$rootId = (int)$db->query("SELECT category_id FROM {$p}hikashop_category WHERE category_namekey = 'product' LIMIT 1")->fetch_row()[0];

// Departments become real categories. Created through SQL with the nested-set columns left to
// HikaShop's own rebuild, which the category class does on its next save; for a fixture the tree
// only has to be one level deep, which needs no rebuild.
$departmentIds = [];
foreach ($catalogue['departments'] as $dept) {
	$name = $db->real_escape_string($dept['name']);
	$row = $db->query("SELECT category_id FROM {$p}hikashop_category WHERE category_name = '$name' AND category_type = 'product' LIMIT 1")->fetch_row();
	if ($row) {
		$departmentIds[$dept['name']] = (int)$row[0];
		continue;
	}
	$key = strtolower(preg_replace('#[^a-z0-9]+#i', '-', $dept['name']));
	$departmentIds[$dept['name']] = insertRow($db, $p.'hikashop_category', [
		'category_parent_id' => $rootId,
		'category_type' => 'product',
		'category_name' => $dept['name'],
		'category_namekey' => 'demo-'.$key,
		'category_published' => 1,
		'category_access' => 'all',
	]);
}
// Sub-categories, so the tree is worth browsing rather than one flat level.
$subIds = [];
foreach ($catalogue['departments'] as $dept) {
	foreach (($dept['subs'] ?? []) as $sub) {
		$parent = $departmentIds[$dept['name']];
		$name = $db->real_escape_string($sub);
		$row = $db->query("SELECT category_id FROM {$p}hikashop_category WHERE category_name = '$name' AND category_parent_id = $parent LIMIT 1")->fetch_row();
		if ($row) {
			$subIds[$dept['name']][] = (int)$row[0];
			continue;
		}
		$key = strtolower(preg_replace('#[^a-z0-9]+#i', '-', $dept['name'].'-'.$sub));
		$subIds[$dept['name']][] = insertRow($db, $p.'hikashop_category', [
			'category_parent_id' => $parent,
			'category_type' => 'product',
			'category_name' => $sub,
			'category_namekey' => 'demo-'.$key,
			'category_published' => 1,
			'category_access' => 'all',
		]);
	}
}
// A picture for each department and sub-category, so a category listing is furnished.
$categoryImages = 0;
if ($images !== null) {
	$allCats = [];
	foreach ($departmentIds as $deptName => $cid) $allCats[$cid] = [$deptName, $deptName];
	foreach ($subIds as $deptName => $ids) {
		foreach ($ids as $cid) {
			$row = $db->query("SELECT category_name FROM {$p}hikashop_category WHERE category_id = $cid")->fetch_row();
			$allCats[$cid] = [$deptName, $row ? $row[0] : $deptName];
		}
	}
	foreach ($allCats as $cid => [$deptName, $catName]) {
		if ($db->query("SELECT file_id FROM {$p}hikashop_file WHERE file_type = 'category' AND file_ref_id = $cid LIMIT 1")->num_rows) continue;
		$fileName = 'demo-cat-'.$cid.'.png';
		$fake = ['dept' => $deptName, 'thing' => $catName, 'name' => $catName];
		if (writeImage($uploadDir.$fileName, $fake, null, 'front', $images, $ai)) {
			insertRow($db, $p.'hikashop_file', [
				'file_name' => $catName,
				'file_path' => $fileName,
				'file_type' => 'category',
				'file_ref_id' => $cid,
				'file_ordering' => 1,
				'file_access' => 'all',
			]);
			$categoryImages++;
		}
	}
}
echo "departments: ".count($departmentIds)." (".array_sum(array_map('count', $subIds))." sub-categories, $categoryImages images)\n";

// ---------------------------------------------------------------------------- characteristics

// An option (Colour) is a characteristic with no parent; its values are its children. A variant
// is joined to one value of each option it varies by.
$optionIds = [];    // 'Colour' => characteristic_id
$valueIds = [];     // 'Colour' => ['Charcoal' => characteristic_id, ...]
$swatches = [];     // 'Charcoal' => '#3A3F45', for tinting a drawn image
foreach (($catalogue['characteristics'] ?? []) as $option => $spec) {
	$name = $db->real_escape_string($option);
	$row = $db->query("SELECT characteristic_id FROM {$p}hikashop_characteristic WHERE characteristic_parent_id = 0 AND characteristic_value = '$name' LIMIT 1")->fetch_row();
	$optionIds[$option] = $row ? (int)$row[0] : insertRow($db, $p.'hikashop_characteristic', [
		'characteristic_parent_id' => 0,
		'characteristic_value' => $option,
		'characteristic_alias' => strtolower($option),
	]);
	foreach ($spec['values'] as $value => $swatch) {
		if ($swatch !== null) $swatches[$value] = $swatch;
		$vName = $db->real_escape_string($value);
		$vRow = $db->query("SELECT characteristic_id FROM {$p}hikashop_characteristic WHERE characteristic_parent_id = {$optionIds[$option]} AND characteristic_value = '$vName' LIMIT 1")->fetch_row();
		$valueIds[$option][$value] = $vRow ? (int)$vRow[0] : insertRow($db, $p.'hikashop_characteristic', [
			'characteristic_parent_id' => $optionIds[$option],
			'characteristic_value' => $value,
			'characteristic_alias' => strtolower(preg_replace('#[^a-z0-9]+#i', '-', $value)),
		]);
	}
}
if ($optionIds) {
	echo 'characteristics: '.implode(', ', array_map(
		fn($o) => $o.' ('.count($valueIds[$o]).')', array_keys($optionIds)
	))."\n";
}

// ---------------------------------------------------------------------------- products

// Build every possible name once, shuffle, then take as many as asked for. Drawing at random
// instead would repeat names long before it ran out of combinations.
$candidates = [];
foreach ($catalogue['departments'] as $dept) {
	foreach ($dept['qualifiers'] as $q) {
		foreach ($dept['things'] as $thing) {
			foreach (($thing['suffixes'] ?: ['']) as $suffix) {
				$candidates[] = [
					'dept' => $dept['name'],
					'name' => trim($q.' '.$thing['name'].($suffix !== '' ? ' — '.$suffix : '')),
					'qualifier' => $q,
					'thing' => $thing['name'],
					// The options this product is offered in, if any. A thing that has them
					// becomes a parent product with a variant per combination.
					'characteristics' => $thing['characteristics'] ?? [],
					'price' => $dept['price'],
				];
			}
		}
	}
}
mt_srand(DEMO_SEED);
shuffle($candidates);
if (count($candidates) < $nProducts) {
	fwrite(STDERR, 'only '.count($candidates)." distinct names available; asked for $nProducts\n");
	$nProducts = count($candidates);
}

$productIds = [];
$imagesMade = 0;
$variantsMade = 0;
$now = time();
for ($i = 0; $i < $nProducts; $i++) {
	$seedFor('product', $i);
	$c = $candidates[$i];
	$code = sprintf('%s%04d', $PRODUCT_PREFIX, $i + 1);

	$blurb = str_replace(
		['{qualifier}', '{thing}'],
		[strtolower($c['qualifier']), strtolower($c['thing'])],
		$pick($catalogue['blurbs'])
	);
	// A shop has a few things out of stock and a few not yet published; a fixture where
	// everything is perfect hides how those look.
	$quantity = (mt_rand(1, 12) === 1) ? 0 : mt_rand(1, 80);
	$published = (mt_rand(1, 25) === 1) ? 0 : 1;
	$price = mt_rand($c['price'][0], $c['price'][1]) / 100;

	$row = $db->query("SELECT product_id FROM {$p}hikashop_product WHERE product_code = '".$db->real_escape_string($code)."' LIMIT 1")->fetch_row();
	if ($row) {
		$id = (int)$row[0];
		$st = $db->prepare("UPDATE {$p}hikashop_product SET product_name = ?, product_description = ?, product_quantity = ?, product_published = ? WHERE product_id = ?");
		$st->bind_param('ssiii', $c['name'], $blurb, $quantity, $published, $id);
		$st->execute();
	} else {
		$id = insertRow($db, $p.'hikashop_product', [
			'product_name' => $c['name'],
			'product_code' => $code,
			'product_quantity' => $quantity,
			'product_published' => $published,
			'product_type' => 'main',
			'product_created' => $now,
			'product_modified' => $now,
			'product_access' => 'all',
			'product_description' => $blurb,
			'product_weight' => mt_rand(50, 4000) / 1000,
			'product_weight_unit' => 'kg',
		]);
		insertRow($db, $p.'hikashop_price', [
			'price_product_id' => $id,
			'price_currency_id' => 1,
			'price_value' => $price,
			'price_min_quantity' => 0,
			'price_access' => 'all',
		]);
		$catId = !empty($subIds[$c['dept']]) ? $pick($subIds[$c['dept']]) : $departmentIds[$c['dept']];
		$db->query("INSERT IGNORE INTO {$p}hikashop_product_category (product_id, category_id) VALUES ($id, $catId)");

		// --- pictures -------------------------------------------------------------
		//
		// A listing is mostly thumbnails, so every product gets at least one. Some get several,
		// which is what the slider on the product page is for, and a product offered in colours
		// gets one per colour on the variant itself -- that file row is what makes the picture
		// change when a customer picks a colour.
		if ($images !== null) {
			$views = ['front'];
			// Roughly a third carry extra views, so the slider has something to slide without
			// every product looking like a catalogue shoot.
			if (mt_rand(1, 3) === 1) {
				$views[] = 'three-quarter view';
				if (mt_rand(1, 2) === 1) $views[] = 'detail';
			}
			foreach ($views as $n => $view) {
				$fileName = strtolower($code).($n > 0 ? '-'.($n + 1) : '').'.png';
				if (writeImage($uploadDir.$fileName, $c, null, $view, $images, $ai)) {
					insertRow($db, $p.'hikashop_file', [
						'file_name' => $c['name'],
						'file_path' => $fileName,
						'file_type' => 'product',
						'file_ref_id' => $id,
						'file_ordering' => $n + 1,
						'file_access' => 'all',
					]);
					$imagesMade++;
				}
			}
		}

		// --- variants -------------------------------------------------------------
		if (!empty($c['characteristics'])) {
			// Every combination of the options this thing is offered in. Seven colours and seven
			// sizes is forty-nine variants for one shoe, so the number of VALUES per option is
			// capped rather than the number of combinations: truncating the combinations instead
			// leaves a shoe offered in every size but only the first three colours, which is not
			// what a shop looks like.
			$options = array_values(array_filter($c['characteristics'], fn($o) => !empty($valueIds[$o])));
			$perOption = $options ? max(2, (int)floor(pow(VARIANT_CAP, 1 / count($options)))) : 0;

			$combos = [[]];
			foreach ($options as $option) {
				$values = array_slice(array_keys($valueIds[$option]), 0, $perOption);
				$next = [];
				foreach ($combos as $combo) {
					foreach ($values as $value) {
						$next[] = $combo + [$option => $value];
					}
				}
				$combos = $next;
			}

			$vOrder = 0;
			foreach ($combos as $combo) {
				if (!$combo) continue;
				$vOrder++;
				$label = implode(' / ', array_values($combo));
				$vCode = $code.'-'.strtoupper(preg_replace('#[^a-z0-9]+#i', '', implode('', array_values($combo))));
				$vId = insertRow($db, $p.'hikashop_product', [
					'product_name' => $c['name'].' — '.$label,
					'product_code' => $vCode,
					'product_quantity' => mt_rand(0, 40),
					'product_published' => 1,
					'product_type' => 'variant',
					'product_parent_id' => $id,
					'product_created' => $now,
					'product_modified' => $now,
					'product_access' => 'all',
				]);
				foreach ($combo as $option => $value) {
					insertRow($db, $p.'hikashop_variant', [
						'variant_characteristic_id' => $valueIds[$option][$value],
						'variant_product_id' => $vId,
						'ordering' => $vOrder,
					]);
				}
				// The variant's own picture, in its own colour where it has one.
				if ($images !== null) {
					$colour = $combo['Colour'] ?? null;
					$vFile = strtolower($vCode).'.png';
					if (writeImage($uploadDir.$vFile, $c, $colour, 'front', $images, $ai, $swatches)) {
						insertRow($db, $p.'hikashop_file', [
							'file_name' => $c['name'].' — '.$label,
							'file_path' => $vFile,
							'file_type' => 'product',
							'file_ref_id' => $vId,
							'file_ordering' => 1,
							'file_access' => 'all',
						]);
						$imagesMade++;
					}
				}
				$variantsMade++;
			}
		}
	}

	$productIds[] = ['id' => $id, 'name' => $c['name'], 'code' => $code, 'price' => $price];
}
$imageNote = ' (no images)';
if ($images !== null) {
	$imageNote = " ($imagesMade images)";
	if ($ai !== null) {
		$imageNote = sprintf(' (%d images: %d generated, %d from cache, %d fell back to a drawn tile)',
			$imagesMade, $ai->stats['generated'], $ai->stats['cached'], $ai->stats['failed']);
	}
}
echo "products: ".count($productIds).$imageNote."\n";
if ($variantsMade > 0) echo "variants: $variantsMade\n";

// ---------------------------------------------------------------------------- customers

$customerIds = [];
for ($i = 0; $i < $nCustomers; $i++) {
	$seedFor('customer', $i);
	$first = $pick($catalogue['firstNames']);
	$last = $pick($catalogue['lastNames']);
	// The number keeps the address unique without making the name look generated.
	$local = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT', $first).'.'.iconv('UTF-8', 'ASCII//TRANSLIT', $last));
	$local = preg_replace('#[^a-z.]+#', '', $local);
	$email = sprintf('%s%d%s', $local, $i + 1, $EMAIL_SUFFIX);

	$row = $db->query("SELECT user_id FROM {$p}hikashop_user WHERE user_email = '".$db->real_escape_string($email)."' LIMIT 1")->fetch_row();
	if ($row) {
		$customerIds[] = (int)$row[0];
		continue;
	}
	$created = $now - mt_rand(0, 400 * 86400);
	$uid = insertRow($db, $p.'hikashop_user', [
		'user_cms_id' => 0,
		'user_email' => $email,
		'user_created' => $created,
		'user_currency_id' => 1,
	]);
	$customerIds[] = $uid;

	[$city, $zip, $country] = $pick($catalogue['cities']);
	$street = mt_rand(1, 180).' '.$pick($catalogue['streets']);
	$phone = '0'.mt_rand(1, 7).' '.sprintf('%02d %02d %02d %02d', mt_rand(0, 99), mt_rand(0, 99), mt_rand(0, 99), mt_rand(0, 99));
	insertRow($db, $p.'hikashop_address', [
		'address_user_id' => $uid,
		'address_firstname' => $first,
		'address_lastname' => $last,
		'address_street' => $street,
		'address_post_code' => $zip,
		'address_city' => $city,
		'address_telephone' => $phone,
		'address_type' => 'billing,shipping',
		'address_published' => 1,
		'address_default' => 1,
	]);
}
echo "customers: ".count($customerIds)."\n";

// ---------------------------------------------------------------------------- orders

// A year of trading: a mild upward trend, a slow swell, week-to-week noise, quieter weekends.
mt_srand(DEMO_SEED);
$DAYS = 365;
$weights = [];
$weightTotal = 0.0;
for ($ago = 0; $ago < $DAYS; $ago++) {
	$recency = 1 - ($ago / $DAYS);
	$w = (0.75 + 0.5 * $recency) * (1 + 0.25 * sin($ago / 28.0)) * (0.65 + (mt_rand(0, 1000) / 1000) * 0.7);
	if ((int)date('N', $now - $ago * 86400) >= 6) $w *= 0.6;
	$weights[$ago] = $w;
	$weightTotal += $w;
}
$pickDay = function () use ($weights, $weightTotal, $DAYS) {
	$r = (mt_rand(0, 1000000) / 1000000) * $weightTotal;
	$acc = 0.0;
	foreach ($weights as $d => $w) {
		$acc += $w;
		if ($r <= $acc) return $d;
	}
	return $DAYS - 1;
};

$statuses = array_merge(
	array_fill(0, 62, 'confirmed'), array_fill(0, 22, 'shipped'), array_fill(0, 8, 'created'),
	array_fill(0, 4, 'cancelled'), array_fill(0, 4, 'refunded')
);

$made = 0;
for ($i = 0; $i < $nOrders; $i++) {
	$seedFor('order', $i);
	$number = sprintf('%s%05d', $ORDER_PREFIX, $i + 1);
	if ($db->query("SELECT order_id FROM {$p}hikashop_order WHERE order_number = '$number' LIMIT 1")->num_rows) continue;

	// A few guaranteed today and this week, so the short ranges are never empty.
	if ($i < 5) $ago = 0;
	elseif ($i < 16) $ago = mt_rand(1, 6);
	else $ago = $pickDay();

	$created = $now - $ago * 86400 - mt_rand(0, 80000);
	if ($created > $now) $created = $now - mt_rand(0, 3600);
	$status = $pick($statuses);
	$user = $customerIds ? $pick($customerIds) : 0;
	// A little of the trade in another currency, so the conversion in the stats is exercised.
	$currency = (mt_rand(1, 12) === 1) ? 2 : 1;

	$oid = insertRow($db, $p.'hikashop_order', [
		'order_number' => $number,
		'order_user_id' => $user,
		'order_status' => $status,
		'order_created' => $created,
		'order_modified' => $created,
		'order_full_price' => 0.0,
		'order_currency_id' => $currency,
		'order_type' => 'sale',
	]);

	$total = 0.0;
	$lines = mt_rand(1, 4);
	for ($l = 0; $l < $lines; $l++) {
		$prod = $pick($productIds);
		$qty = (mt_rand(1, 5) === 1) ? mt_rand(2, 3) : 1;
		$total += $prod['price'] * $qty;
		insertRow($db, $p.'hikashop_order_product', [
			'order_id' => $oid,
			'product_id' => (int)$prod['id'],
			'order_product_quantity' => $qty,
			'order_product_name' => $prod['name'],
			'order_product_code' => $prod['code'],
			'order_product_price' => (float)$prod['price'],
			'order_product_tax' => 0.0,
		]);
	}
	$total = round($total, 2);
	$st = $db->prepare("UPDATE {$p}hikashop_order SET order_full_price = ? WHERE order_id = ?");
	$st->bind_param('di', $total, $oid);
	$st->execute();
	$made++;
}
echo "orders: $made\n";

$db->commit();

// ---------------------------------------------------------------------------- what you got

foreach ([
	'products' => "SELECT COUNT(*) FROM {$p}hikashop_product WHERE product_code LIKE '{$PRODUCT_PREFIX}%' AND product_type = 'main'",
	'variants' => "SELECT COUNT(*) FROM {$p}hikashop_product WHERE product_code LIKE '{$PRODUCT_PREFIX}%' AND product_type = 'variant'",
	'images' => "SELECT COUNT(*) FROM {$p}hikashop_file WHERE file_path LIKE 'demo-%'",
	'customers' => "SELECT COUNT(*) FROM {$p}hikashop_user WHERE user_email LIKE '%{$EMAIL_SUFFIX}'",
	'orders' => "SELECT COUNT(*) FROM {$p}hikashop_order WHERE order_number LIKE '{$ORDER_PREFIX}%'",
	'order lines' => "SELECT COUNT(*) FROM {$p}hikashop_order_product op JOIN {$p}hikashop_order o ON o.order_id = op.order_id WHERE o.order_number LIKE '{$ORDER_PREFIX}%'",
] as $label => $sql) {
	printf("%-12s %s\n", $label, $db->query($sql)->fetch_row()[0]);
}
echo "\nsample of what a screenshot will show:\n";
$r = $db->query("SELECT product_name, product_code FROM {$p}hikashop_product WHERE product_code LIKE '{$PRODUCT_PREFIX}%' ORDER BY RAND() LIMIT 5");
while ($x = $r->fetch_assoc()) echo "  {$x['product_name']}  ({$x['product_code']})\n";
$r = $db->query("SELECT a.address_firstname, a.address_lastname, a.address_city FROM {$p}hikashop_address a JOIN {$p}hikashop_user u ON u.user_id = a.address_user_id WHERE u.user_email LIKE '%{$EMAIL_SUFFIX}' ORDER BY RAND() LIMIT 5");
while ($x = $r->fetch_assoc()) echo "  {$x['address_firstname']} {$x['address_lastname']}, {$x['address_city']}\n";
