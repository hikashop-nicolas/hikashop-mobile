<?php
// A concept store, written backwards.
//
// The other two themes were written first and then sent looking for photographs, which is how a
// shop ends up with a stir-fry under "Cast Iron Skillet". This one was written from the answer:
// prospect-stock.php probed 145 candidate nouns, kept the 63 the library really photographs on
// their own, and the vocabulary below is the strongest of those.
//
// That is why it sells watches and vases rather than saucepans and jumpers. It is not a
// compromise so much as a different shop -- the kind whose stock is small, hard-edged and
// photographed on a table, which is exactly the kind stock libraries are full of.
//
// Two rules kept it honest:
//
//   A thing's name IS its search term, so nothing needs a 'stock' override and nothing can drift
//   away from the photograph that justified including it.
//
//   No colour characteristics. A search cannot return one bag in six colours, so a colour here
//   would mean a gradient tile on every variant. Sizes are fine: the same photograph across a run
//   of sizes is what a real shop does anyway.

return [

	'name' => 'Concept store',

	'characteristics' => [
		'Size' => [
			'values' => ['XS' => null, 'S' => null, 'M' => null, 'L' => null, 'XL' => null],
		],
	],

	'departments' => [
		[
			'name' => 'Coffee & Tea',
			'subs' => ['Coffee Beans', 'Ground Coffee', 'Brewing', 'Espresso Cups', 'Teapots'],
			'price' => [750, 8900],
			'qualifiers' => ['Single Origin', 'Slow-Roasted', 'Hand-Thrown', 'Small-Batch', 'Stoneware'],
			'things' => [
				['name' => 'Coffee Beans', 'suffixes' => ['250 g', '500 g', '1 kg']],
				['name' => 'Ground Coffee', 'suffixes' => ['250 g', '500 g']],
				['name' => 'Coffee Grinder', 'suffixes' => ['']],
				['name' => 'Espresso Cup', 'suffixes' => ['Single', 'Set of 2', 'Set of 4']],
				['name' => 'Teapot', 'suffixes' => ['0.5 L', '0.8 L', '1.2 L'], 'stock' => 'ceramic teapot'],
				['name' => 'Mug', 'suffixes' => ['300 ml', '400 ml']],
			],
		],
		[
			'name' => 'Desk & Paper',
			'subs' => ['Notebooks', 'Pens', 'Pencils', 'Planners', 'Desk'],
			'price' => [450, 14500],
			'qualifiers' => ['Cloth-Bound', 'Brass', 'Refillable', 'Recycled', 'Lacquered'],
			'things' => [
				['name' => 'Notebook', 'suffixes' => ['A6', 'A5', 'A4']],
				['name' => 'Fountain Pen', 'suffixes' => ['Fine', 'Medium', 'Broad']],
				['name' => 'Ballpoint Pen', 'suffixes' => ['']],
				['name' => 'Colored Pencils', 'suffixes' => ['12', '24', '36']],
				['name' => 'Planner', 'suffixes' => ['Weekly', 'Daily']],
				['name' => 'Alarm Clock', 'suffixes' => ['']],
			],
		],
		[
			'name' => 'Home',
			'subs' => ['Vases', 'Candles', 'Lighting', 'Frames', 'Clocks', 'Plants'],
			'price' => [900, 21000],
			'qualifiers' => ['Hand-Glazed', 'Matt Black', 'Oak', 'Speckled', 'Hand-Poured', 'Ribbed'],
			'things' => [
				['name' => 'Ceramic Vase', 'suffixes' => ['Small', 'Medium', 'Tall']],
				['name' => 'Scented Candle', 'suffixes' => ['180 g', '380 g']],
				['name' => 'Table Lamp', 'suffixes' => ['']],
				['name' => 'Picture Frame', 'suffixes' => ['13 × 18', '21 × 30', '30 × 40']],
				['name' => 'Wall Clock', 'suffixes' => ['25 cm', '35 cm']],
				['name' => 'Plant Pot', 'suffixes' => ['12 cm', '16 cm', '22 cm']],
				['name' => 'Incense', 'suffixes' => ['30 sticks', '60 sticks']],
				['name' => 'Cushion', 'suffixes' => ['45 × 45', '50 × 50']],
			],
		],
		[
			'name' => 'Bags & Wear',
			'subs' => ['Bags', 'Wallets', 'Shoes', 'Socks'],
			'price' => [1200, 34000],
			'qualifiers' => ['Full-Grain', 'Waxed Canvas', 'Vegetable-Tanned', 'Merino', 'Suede'],
			'things' => [
				['name' => 'Leather Bag', 'suffixes' => ['']],
				['name' => 'Tote Bag', 'suffixes' => ['']],
				['name' => 'Wallet', 'suffixes' => ['Card', 'Bifold']],
				['name' => 'Sneakers', 'suffixes' => [''], 'characteristics' => ['Size']],
				['name' => 'Boots', 'suffixes' => [''], 'characteristics' => ['Size']],
				['name' => 'Sandals', 'suffixes' => [''], 'characteristics' => ['Size'], 'stock' => 'leather sandals'],
				['name' => 'Socks', 'suffixes' => ['Pair', 'Three Pack'], 'characteristics' => ['Size']],
			],
		],
		[
			'name' => 'Jewellery',
			'subs' => ['Necklaces', 'Bracelets', 'Earrings'],
			'price' => [1900, 42000],
			'qualifiers' => ['Sterling Silver', 'Gold-Plated', 'Freshwater Pearl', 'Hand-Finished'],
			'things' => [
				['name' => 'Necklace', 'suffixes' => ['40 cm', '45 cm', '50 cm']],
				['name' => 'Bracelet', 'suffixes' => ['S', 'M', 'L']],
				['name' => 'Earrings', 'suffixes' => ['Pair']],
				['name' => 'Pendant', 'suffixes' => ['']],
			],
		],
		[
			'name' => 'Beauty',
			'subs' => ['Fragrance', 'Skincare Products', 'Shampoo'],
			'price' => [850, 16500],
			'qualifiers' => ['Unscented', 'Cold-Pressed', 'Botanical', 'Refill'],
			'things' => [
				['name' => 'Perfume Bottle', 'suffixes' => ['30 ml', '50 ml', '100 ml']],
				['name' => 'Cosmetic Jar', 'suffixes' => ['50 ml', '100 ml']],
				['name' => 'Shampoo Bottle', 'suffixes' => ['250 ml', '500 ml']],
			],
		],
		[
			'name' => 'Sound & Photo',
			'subs' => ['Headphones', 'Cameras', 'Records', 'Desk'],
			'price' => [1500, 48000],
			'qualifiers' => ['Over-Ear', 'Refurbished', 'Mechanical', 'Wireless', 'Anodised'],
			'things' => [
				['name' => 'Headphones', 'suffixes' => ['']],
				['name' => 'Film Camera', 'suffixes' => ['35 mm', 'Compact']],
				['name' => 'Vinyl Record', 'suffixes' => ['LP', '7"']],
				['name' => 'Keyboard', 'suffixes' => ['Tenkeyless', 'Full Size']],
				['name' => 'Computer Mouse', 'suffixes' => ['']],
			],
		],
	],

	'blurbs' => [
		'A {thing} we have carried since the shop opened, and still the one we use ourselves.',
		'{qualifier}, made in small runs by a workshop we visit every year.',
		'Our best-selling {thing}. Back in stock, and worth the wait.',
		'Simple, well made, and meant to last longer than the trend that sold it.',
		'Chosen because it does one thing properly and nothing else at all.',
	],

	'people' => null,

	'firstNames' => [
		'Camille', 'Léa', 'Hugo', 'Thomas', 'Manon', 'Julien', 'Chloé', 'Antoine', 'Sarah', 'Nicolas',
		'Sofia', 'Marco', 'Elena', 'Giulia', 'Luca', 'Matteo',
		'James', 'Olivia', 'Harry', 'Amelia', 'George', 'Isla', 'Oscar', 'Freya',
		'Lukas', 'Hannah', 'Felix', 'Lena', 'Jonas', 'Marie',
		'Ana', 'Diego', 'Lucía', 'Javier', 'Carmen', 'Pablo',
		'Sanne', 'Daan', 'Femke', 'Bram',
		'Aisha', 'Omar', 'Yara', 'Karim',
		'Kenji', 'Yuki', 'Sakura', 'Wei',
	],
	'lastNames' => [
		'Martin', 'Bernard', 'Dubois', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Laurent',
		'Rossi', 'Russo', 'Ferrari', 'Bianchi',
		'Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans',
		'Müller', 'Schmidt', 'Schneider', 'Fischer',
		'García', 'Fernández', 'López', 'Martínez',
		'De Vries', 'Van Dijk', 'Jansen',
		'Haddad', 'Nasser', 'Aziz',
		'Tanaka', 'Suzuki', 'Chen', 'Wang',
	],
	'emailDomains' => ['example.com', 'example.org', 'example.net'],

	'streets' => ['Rue des Lilas', 'Avenue du Parc', 'Chemin des Vignes', 'Rue Basse', 'Allée des Tilleuls',
		'Mill Lane', 'Harbour Road', 'Orchard Way', 'Station Road', 'Bridge Street'],
	'cities' => [
		['Lyon', '69003', 'France'], ['Nantes', '44000', 'France'], ['Bordeaux', '33000', 'France'],
		['Lille', '59000', 'France'], ['Toulouse', '31000', 'France'],
		['Bristol', 'BS1 5TR', 'United Kingdom'], ['Leeds', 'LS1 4DY', 'United Kingdom'],
		['Antwerpen', '2000', 'Belgium'], ['Gent', '9000', 'Belgium'],
		['Köln', '50667', 'Germany'], ['Leipzig', '04109', 'Germany'],
	],

	'imagery' => [
		'palettes' => [
			'Coffee & Tea'  => ['#4A3328', '#C9A184'],
			'Desk & Paper'  => ['#333E52', '#A9B4C7'],
			'Home'          => ['#5C4A35', '#D6BE9C'],
			'Bags & Wear'   => ['#3B2A20', '#B99271'],
			'Jewellery'     => ['#2E2A33', '#BFAFC4'],
			'Beauty'        => ['#4A3B52', '#C3A5B4'],
			'Sound & Photo' => ['#25303A', '#93A8B8'],
		],
		'style' => 'single object on a plain pale background, soft studio lighting, sharp focus, e-commerce catalogue photo',
	],
];
