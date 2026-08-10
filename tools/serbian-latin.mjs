// Write the Serbian Latin catalogue from the Cyrillic one.
//
// Serbian is digraphic: the two alphabets map one to one, and the same text is written in either.
// So sr-YU is not a second translation, it is sr-RS in the other alphabet, and keeping it that way
// by hand would mean two files drifting apart. The fallback rules still keep the two locales
// apart at runtime: a reader who asked for one alphabet must never be shown the other.
//
//   node tools/serbian-latin.mjs
//
// Reads src/i18n/manual/sr-RS.json and writes src/i18n/manual/sr-YU.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MAP = {
	а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z', и: 'i',
	ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r',
	с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'č', џ: 'dž', ш: 'š',
};

// A capital digraph is written Lj before a lower-case letter and LJ inside a run of capitals, so
// the next character decides. Anything not Cyrillic (placeholders, GTIN, QR) passes through.
function toLatin(text) {
	let out = '';
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		const lower = ch.toLowerCase();
		const latin = MAP[lower];
		if (latin === undefined) { out += ch; continue; }
		if (ch === lower) { out += latin; continue; }
		if (latin.length === 1) { out += latin.toUpperCase(); continue; }
		const next = text[i + 1] ?? '';
		const allCaps = next !== '' && MAP[next.toLowerCase()] !== undefined && next !== next.toLowerCase();
		out += allCaps ? latin.toUpperCase() : latin[0].toUpperCase() + latin.slice(1);
	}
	return out;
}

const dir = join('src', 'i18n', 'manual');
const src = JSON.parse(readFileSync(join(dir, 'sr-RS.json'), 'utf8'));

const out = {
	_comment: [
		'Serbian (Latin), written from sr-RS.json by tools/serbian-latin.mjs. Do not edit: correct',
		'the Cyrillic and run the tool again, or the two alphabets drift apart.',
		'Serbian is digraphic and the two map one to one, so this is the same text in the other',
		'alphabet rather than a second translation. Neither locale falls back to the other: a reader',
		'who asked for one alphabet must not be shown the other.',
	],
};
for (const [key, value] of Object.entries(src)) {
	if (key === '_comment') continue;
	out[key] = toLatin(value);
}

writeFileSync(join(dir, 'sr-YU.json'), JSON.stringify(out, null, '\t') + '\n');
console.log(`sr-YU.json written, ${Object.keys(out).length - 1} strings`);
