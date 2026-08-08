<?php
// A shoe shop.
//
// Written as a second theme mainly to prove the first one is not the generator: everything that
// differs between these two files is data. It also leans harder on variants than the general
// store does, since almost everything a shoe shop sells comes in a colour and a size, which is
// the case the per-variant images exist for.

return [

	'name' => 'Shoe shop',

	'characteristics' => [
		'Colour' => [
			'values' => [
				'Black' => '#1E1E20',
				'White' => '#EDEAE4',
				'Tan' => '#A8703F',
				'Oxblood' => '#5C2130',
				'Sand' => '#D6C3A5',
				'Olive' => '#5A6140',
				'Navy' => '#22314F',
			],
		],
		'Size' => [
			'values' => ['38' => null, '39' => null, '40' => null, '41' => null, '42' => null, '43' => null, '44' => null],
		],
	],

	'departments' => [
		[
			'name' => 'Trainers',
			'subs' => ['Running', 'Court', 'Retro', 'Trail'],
			'price' => [5500, 18500],
			'qualifiers' => ['Suede', 'Mesh', 'Canvas', 'Knit', 'Leather'],
			'things' => [
				['name' => 'Runner', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Court Trainer', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Trail Shoe', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Retro Trainer', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Slip-On', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
			],
		],
		[
			'name' => 'Boots',
			'subs' => ['Chelsea', 'Hiking', 'Work', 'Winter'],
			'price' => [8900, 32000],
			'qualifiers' => ['Waxed Leather', 'Nubuck', 'Waterproof', 'Shearling-Lined', 'Full-Grain'],
			'things' => [
				['name' => 'Chelsea Boot', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Hiking Boot', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Desert Boot', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Work Boot', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
			],
		],
		[
			'name' => 'Formal',
			'subs' => ['Oxfords', 'Derbies', 'Loafers', 'Monk Straps'],
			'price' => [9500, 39000],
			'qualifiers' => ['Calf Leather', 'Polished', 'Hand-Stitched', 'Goodyear-Welted'],
			'things' => [
				['name' => 'Oxford', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Derby', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Loafer', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Monk Strap', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
			],
		],
		[
			'name' => 'Sandals',
			'subs' => ['Slides', 'Walking', 'Espadrilles'],
			'price' => [2900, 11000],
			'qualifiers' => ['Cork-Footbed', 'Woven', 'Padded', 'Recycled'],
			'things' => [
				['name' => 'Slide', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Walking Sandal', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
				['name' => 'Espadrille', 'suffixes' => [''], 'characteristics' => ['Colour', 'Size']],
			],
		],
		[
			'name' => 'Care & Accessories',
			'subs' => ['Laces', 'Insoles', 'Care', 'Bags'],
			'price' => [400, 3500],
			'qualifiers' => ['Waxed', 'Cotton', 'Leather', 'Cedar', 'Merino'],
			// 'stock' overrides what Pexels is searched for, where the product's own name is a bad
			// search term. "Shoe Trees" returns shoes hanging from trees in a forest.
			'things' => [
				['name' => 'Laces', 'suffixes' => ['90 cm', '120 cm', '150 cm'], 'characteristics' => ['Colour']],
				['name' => 'Insoles', 'suffixes' => ['38-40', '41-43', '44-46'], 'stock' => 'shoe insole'],
				['name' => 'Shoe Trees', 'suffixes' => ['S', 'M', 'L'], 'stock' => 'wooden shoe last'],
				['name' => 'Cleaning Kit', 'suffixes' => [''], 'stock' => 'shoe polish brush'],
				['name' => 'Protector Spray', 'suffixes' => ['200 ml'], 'stock' => 'spray bottle'],
				['name' => 'Shoe Bag', 'suffixes' => ['Pair'], 'characteristics' => ['Colour']],
			],
		],
	],

	'blurbs' => [
		'A {thing} built on our own last, so it fits the way it did last season.',
		'{qualifier} upper, resoleable, and made to be worn every day.',
		'Our best-selling {thing}. Back in stock in the full run of sizes.',
		'Broken in from the first wear, and easy to keep looking good.',
		'Made in a family workshop that has been at it for three generations.',
	],

	'people' => null,   // falls back to the shared list below

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
			'Trainers'           => ['#2B3440', '#A9BBC9'],
			'Boots'              => ['#3B2A20', '#B99271'],
			'Formal'             => ['#241F22', '#9C8A93'],
			'Sandals'            => ['#4A4327', '#D8CBA0'],
			'Care & Accessories' => ['#2E3A34', '#A6BCAE'],
		],
		'style' => 'single shoe on a plain pale background, soft studio lighting, three-quarter angle, sharp focus, e-commerce catalogue photo',
	],
];
