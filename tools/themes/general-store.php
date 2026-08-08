<?php
// The vocabulary the demo shop is built from.
//
// Kept apart from the seeding script so the shop can be re-themed without touching the logic,
// and so it is obvious at a glance what a screenshot will contain.
//
// Names are assembled rather than listed one by one: a handful of lines here produce hundreds of
// products that all read like real ones, which a flat list of 300 names could not do without
// becoming unmaintainable.

return [

	'name' => 'General store',

	// The options a thing can offer. A colour carries a swatch so a drawn image can be tinted
	// towards it and a generated one can be asked for that colour by name.
	'characteristics' => [
		'Colour' => [
			'values' => [
				'Charcoal' => '#3A3F45',
				'Navy' => '#22314F',
				'Oatmeal' => '#D8CBB4',
				'Forest' => '#2F4A38',
				'Rust' => '#9C4A2F',
				'Ecru' => '#E4DED2',
			],
		],
		'Size' => [
			'values' => ['S' => null, 'M' => null, 'L' => null, 'XL' => null],
		],
	],

	// Each department gives its products a shape: a material or qualifier, a thing, and sometimes
	// a variant. The price band keeps a department's prices plausible against each other, and the
	// sub-categories give the tree the depth a real shop's has, so browsing it means something.
	'departments' => [
		[
			'name' => 'Kitchen',
			'subs' => ['Cookware', 'Bakeware', 'Knives & Boards', 'Coffee Making', 'Storage', 'Table Linen'],
			'price' => [1200, 14900],
			'qualifiers' => ['Cast Iron', 'Stainless Steel', 'Enamelled', 'Copper', 'Stoneware', 'Bamboo', 'Non-Stick', 'Hand-Blown'],
			'things' => [
				['name' => 'Skillet', 'suffixes' => ['20 cm', '24 cm', '26 cm', '28 cm']],
				['name' => 'Saucepan', 'suffixes' => ['1.5 L', '2 L', '3 L']],
				['name' => 'Casserole Dish', 'suffixes' => ['3 L', '4.5 L', '6 L'], 'characteristics' => ['Colour']],
				['name' => 'Mixing Bowl', 'suffixes' => ['Small', 'Medium', 'Large'], 'characteristics' => ['Colour']],
				['name' => 'Chopping Board', 'suffixes' => ['Small', 'Large']],
				['name' => 'Kettle', 'suffixes' => ['1.5 L', '1.7 L']],
				['name' => 'Cafetière', 'suffixes' => ['3 cup', '8 cup']],
				['name' => 'Roasting Tin', 'suffixes' => ['Medium', 'Large']],
				['name' => 'Colander', 'suffixes' => ['22 cm', '26 cm']],
				['name' => 'Pepper Mill', 'suffixes' => ['']],
			],
		],
		[
			'name' => 'Clothing',
			'subs' => ['Knitwear', 'Shirts', 'Trousers', 'Outerwear', 'Accessories', 'Socks & Underwear'],
			'price' => [1800, 22000],
			'qualifiers' => ['Merino Wool', 'Organic Cotton', 'Linen', 'Waxed Cotton', 'Cashmere', 'Corduroy', 'Denim'],
			'things' => [
				['name' => 'Scarf', 'suffixes' => [''], 'characteristics' => ['Colour']],
				['name' => 'Crew Jumper', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Overshirt', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Field Jacket', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Chinos', 'suffixes' => ['30', '32', '34', '36']],
				['name' => 'Oxford Shirt', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Beanie', 'suffixes' => [''], 'characteristics' => ['Colour']],
				['name' => 'Socks', 'suffixes' => ['39-42', '43-46']],
			],
		],
		[
			'name' => 'Outdoor',
			'subs' => ['Rucksacks', 'Sleeping', 'Lighting', 'Cooking', 'Navigation', 'Water'],
			'price' => [2500, 39000],
			'qualifiers' => ['Lightweight', 'Insulated', 'Packable', 'All-Weather', 'Trail', 'Alpine'],
			'things' => [
				['name' => 'Backpack', 'suffixes' => ['20 L', '35 L', '60 L'], 'characteristics' => ['Colour']],
				['name' => 'Sleeping Bag', 'suffixes' => ['Comfort 0°C', 'Comfort -5°C', 'Comfort 5°C']],
				['name' => 'Head Torch', 'suffixes' => ['200 lm', '400 lm']],
				['name' => 'Water Bottle', 'suffixes' => ['500 ml', '750 ml', '1 L'], 'characteristics' => ['Colour']],
				['name' => 'Trekking Poles', 'suffixes' => ['Pair']],
				['name' => 'Dry Bag', 'suffixes' => ['5 L', '10 L', '20 L'], 'characteristics' => ['Colour']],
				['name' => 'Camping Stove', 'suffixes' => ['']],
				['name' => 'Hammock', 'suffixes' => ['Single', 'Double']],
			],
		],
		[
			'name' => 'Home',
			'subs' => ['Lighting', 'Cushions & Throws', 'Storage', 'Wall Décor', 'Rugs', 'Candles'],
			'price' => [900, 26000],
			'qualifiers' => ['Linen', 'Hand-Woven', 'Ceramic', 'Solid Oak', 'Recycled Glass', 'Brushed Brass'],
			'things' => [
				['name' => 'Throw', 'suffixes' => ['130 × 170', '150 × 200'], 'characteristics' => ['Colour']],
				['name' => 'Cushion Cover', 'suffixes' => ['40 × 40', '50 × 50'], 'characteristics' => ['Colour']],
				['name' => 'Table Lamp', 'suffixes' => ['']],
				['name' => 'Picture Frame', 'suffixes' => ['A4', 'A3', '30 × 40']],
				['name' => 'Storage Basket', 'suffixes' => ['Small', 'Medium', 'Large']],
				['name' => 'Wall Clock', 'suffixes' => ['']],
				['name' => 'Vase', 'suffixes' => ['Small', 'Tall'], 'characteristics' => ['Colour']],
				['name' => 'Door Mat', 'suffixes' => ['']],
			],
		],
		[
			'name' => 'Stationery',
			'subs' => ['Notebooks', 'Pens & Pencils', 'Desk', 'Cards & Letters', 'Diaries'],
			'price' => [300, 8500],
			'qualifiers' => ['Leather-Bound', 'Recycled', 'Dotted', 'Ruled', 'Hand-Marbled', 'Cloth-Bound'],
			'things' => [
				['name' => 'Notebook', 'suffixes' => ['A4', 'A5', 'A6', 'Pocket'], 'characteristics' => ['Colour']],
				['name' => 'Sketchbook', 'suffixes' => ['A4', 'A5']],
				['name' => 'Fountain Pen', 'suffixes' => ['Fine', 'Medium']],
				['name' => 'Pencil Set', 'suffixes' => ['']],
				['name' => 'Desk Pad', 'suffixes' => ['']],
				['name' => 'Letter Set', 'suffixes' => ['']],
				['name' => 'Diary', 'suffixes' => ['A5', 'Pocket'], 'characteristics' => ['Colour']],
			],
		],
		[
			'name' => 'Coffee & Tea',
			'subs' => ['Coffee Beans', 'Ground Coffee', 'Black Tea', 'Green Tea', 'Herbal', 'Gifts'],
			'price' => [600, 4800],
			'qualifiers' => ['Single Origin', 'Organic', 'Decaffeinated', 'Small Batch', 'Loose Leaf'],
			'things' => [
				['name' => 'Espresso Blend', 'suffixes' => ['250 g', '500 g', '1 kg']],
				['name' => 'Filter Coffee', 'suffixes' => ['250 g', '500 g', '1 kg']],
				['name' => 'Earl Grey', 'suffixes' => ['100 g', '250 g']],
				['name' => 'Sencha', 'suffixes' => ['100 g', '250 g']],
				['name' => 'Rooibos', 'suffixes' => ['100 g', '250 g']],
				['name' => 'Breakfast Blend', 'suffixes' => ['250 g', '500 g']],
				['name' => 'Chai', 'suffixes' => ['100 g', '250 g']],
			],
		],
	],

	// Sentences a shop actually writes, filled in with the product's own words.
	'blurbs' => [
		'Made to last, and easy to live with. The {thing} you reach for without thinking.',
		'A {qualifier} {thing} finished by hand. Sold on its own or as part of the range.',
		'Our best-selling {thing}, back in stock after a long wait.',
		'Simple, well made, and quietly good at its job.',
		'Designed in-house and produced in small runs by a family workshop.',
	],

	// Customers. Deliberately drawn from several places, because a shop's customer list is not
	// all one nationality and a screenshot showing only one looks staged.
	'firstNames' => [
		'Camille', 'Léa', 'Hugo', 'Thomas', 'Manon', 'Julien', 'Chloé', 'Antoine', 'Sarah', 'Nicolas',
		'Emma', 'Lucas', 'Inès', 'Maxime', 'Louise', 'Théo', 'Jeanne', 'Paul', 'Alice', 'Mathieu',
		'Sofia', 'Marco', 'Elena', 'Andrea', 'Giulia', 'Luca', 'Martina', 'Matteo',
		'James', 'Olivia', 'Harry', 'Amelia', 'George', 'Isla', 'Oscar', 'Freya', 'Arthur', 'Poppy',
		'Lukas', 'Hannah', 'Felix', 'Lena', 'Jonas', 'Marie', 'Anton', 'Clara',
		'Ana', 'Diego', 'Lucía', 'Javier', 'Carmen', 'Pablo',
		'Sanne', 'Daan', 'Femke', 'Bram', 'Anouk', 'Sven',
		'Aisha', 'Omar', 'Yara', 'Karim', 'Nadia', 'Tariq',
		'Kenji', 'Yuki', 'Haruto', 'Sakura', 'Mei', 'Wei',
	],
	'lastNames' => [
		'Martin', 'Bernard', 'Dubois', 'Robert', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent',
		'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano',
		'Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'Wright',
		'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner',
		'García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Ramírez',
		'De Vries', 'Van Dijk', 'Jansen', 'Bakker', 'Visser',
		'Haddad', 'Nasser', 'Aziz', 'Khoury',
		'Tanaka', 'Suzuki', 'Sato', 'Watanabe', 'Chen', 'Wang',
	],
	'emailDomains' => ['example.com', 'example.org', 'example.net'],

	'imagery' => [
		'palettes' => [
			'Kitchen'      => ['#2F4A5C', '#8EB8C4'],
			'Clothing'     => ['#4A3B52', '#C3A5B4'],
			'Outdoor'      => ['#254B3A', '#9CC08F'],
			'Home'         => ['#5C4A35', '#D6BE9C'],
			'Stationery'   => ['#333E52', '#A9B4C7'],
			'Coffee & Tea' => ['#4A3328', '#C9A184'],
		],
		// How a generated photograph of this shop's goods should look.
		'style' => 'plain light background, soft studio lighting, centred, sharp focus, e-commerce catalogue photo',
	],

	// Addresses. Street names are invented rather than real, so nothing here points at a real
	// person's door: this data ends up in screenshots.
	'streets' => ['Rue des Lilas', 'Avenue du Parc', 'Chemin des Vignes', 'Rue Basse', 'Allée des Tilleuls',
		'Mill Lane', 'Harbour Road', 'Orchard Way', 'Station Road', 'Bridge Street'],
	'cities' => [
		['Lyon', '69003', 'France'], ['Nantes', '44000', 'France'], ['Bordeaux', '33000', 'France'],
		['Lille', '59000', 'France'], ['Toulouse', '31000', 'France'],
		['Bristol', 'BS1 5TR', 'United Kingdom'], ['Leeds', 'LS1 4DY', 'United Kingdom'],
		['Antwerpen', '2000', 'Belgium'], ['Gent', '9000', 'Belgium'],
		['Köln', '50667', 'Germany'], ['Leipzig', '04109', 'Germany'],
	],
];
