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
				['Skillet', ['20 cm', '24 cm', '26 cm', '28 cm']],
				['Saucepan', ['1.5 L', '2 L', '3 L']],
				['Casserole Dish', ['3 L', '4.5 L', '6 L']],
				['Mixing Bowl', ['Small', 'Medium', 'Large']],
				['Chopping Board', ['Small', 'Large']],
				['Kettle', ['1.5 L', '1.7 L']],
				['Cafetière', ['3 cup', '8 cup']],
				['Roasting Tin', ['Medium', 'Large']],
				['Colander', ['22 cm', '26 cm']],
				['Pepper Mill', ['']],
			],
		],
		[
			'name' => 'Clothing',
			'subs' => ['Knitwear', 'Shirts', 'Trousers', 'Outerwear', 'Accessories', 'Socks & Underwear'],
			'price' => [1800, 22000],
			'qualifiers' => ['Merino Wool', 'Organic Cotton', 'Linen', 'Waxed Cotton', 'Cashmere', 'Corduroy', 'Denim'],
			'things' => [
				['Scarf', ['Charcoal', 'Navy', 'Oatmeal', 'Rust']],
				['Crew Jumper', ['S', 'M', 'L', 'XL']],
				['Overshirt', ['S', 'M', 'L', 'XL']],
				['Field Jacket', ['S', 'M', 'L', 'XL']],
				['Chinos', ['30', '32', '34', '36']],
				['Oxford Shirt', ['S', 'M', 'L', 'XL']],
				['Beanie', ['Charcoal', 'Forest', 'Ecru']],
				['Socks', ['39-42', '43-46']],
			],
		],
		[
			'name' => 'Outdoor',
			'subs' => ['Rucksacks', 'Sleeping', 'Lighting', 'Cooking', 'Navigation', 'Water'],
			'price' => [2500, 39000],
			'qualifiers' => ['Lightweight', 'Insulated', 'Packable', 'All-Weather', 'Trail', 'Alpine'],
			'things' => [
				['Backpack', ['20 L', '35 L', '60 L']],
				['Sleeping Bag', ['Comfort 0°C', 'Comfort -5°C', 'Comfort 5°C']],
				['Head Torch', ['200 lm', '400 lm']],
				['Water Bottle', ['500 ml', '750 ml', '1 L']],
				['Trekking Poles', ['Pair']],
				['Dry Bag', ['5 L', '10 L', '20 L']],
				['Camping Stove', ['']],
				['Hammock', ['Single', 'Double']],
			],
		],
		[
			'name' => 'Home',
			'subs' => ['Lighting', 'Cushions & Throws', 'Storage', 'Wall Décor', 'Rugs', 'Candles'],
			'price' => [900, 26000],
			'qualifiers' => ['Linen', 'Hand-Woven', 'Ceramic', 'Solid Oak', 'Recycled Glass', 'Brushed Brass'],
			'things' => [
				['Throw', ['130 × 170', '150 × 200']],
				['Cushion Cover', ['40 × 40', '50 × 50']],
				['Table Lamp', ['']],
				['Picture Frame', ['A4', 'A3', '30 × 40']],
				['Storage Basket', ['Small', 'Medium', 'Large']],
				['Wall Clock', ['']],
				['Vase', ['Small', 'Tall']],
				['Door Mat', ['']],
			],
		],
		[
			'name' => 'Stationery',
			'subs' => ['Notebooks', 'Pens & Pencils', 'Desk', 'Cards & Letters', 'Diaries'],
			'price' => [300, 8500],
			'qualifiers' => ['Leather-Bound', 'Recycled', 'Dotted', 'Ruled', 'Hand-Marbled', 'Cloth-Bound'],
			'things' => [
				['Notebook', ['A4', 'A5', 'A6', 'Pocket']],
				['Sketchbook', ['A4', 'A5']],
				['Fountain Pen', ['Fine', 'Medium']],
				['Pencil Set', ['']],
				['Desk Pad', ['']],
				['Letter Set', ['']],
				['Diary', ['A5', 'Pocket']],
			],
		],
		[
			'name' => 'Coffee & Tea',
			'subs' => ['Coffee Beans', 'Ground Coffee', 'Black Tea', 'Green Tea', 'Herbal', 'Gifts'],
			'price' => [600, 4800],
			'qualifiers' => ['Single Origin', 'Organic', 'Decaffeinated', 'Small Batch', 'Loose Leaf'],
			'things' => [
				['Espresso Blend', ['250 g', '500 g', '1 kg']],
				['Filter Coffee', ['250 g', '500 g', '1 kg']],
				['Earl Grey', ['100 g', '250 g']],
				['Sencha', ['100 g', '250 g']],
				['Rooibos', ['100 g', '250 g']],
				['Breakfast Blend', ['250 g', '500 g']],
				['Chai', ['100 g', '250 g']],
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
