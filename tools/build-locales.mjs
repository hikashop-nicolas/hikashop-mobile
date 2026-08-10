// Build the app's translation catalogues from HikaShop's own language files.
//
// HikaShop is translated into 60 languages, 4,400 strings each, by people who know the shop's
// vocabulary. The app says many of the same things: Products, Orders, Add to cart, Quantity,
// Out of stock. Translating those again would be inventing a second vocabulary for the same
// shop, in 60 languages, none of which we could check.
//
// So this maps the app's keys onto HikaShop's and reads the translation out of the .ini files.
// Nothing is invented here: a string either has an official HikaShop translation or it is left
// out, and the app falls back to English for it, per string.
//
//   node tools/build-locales.mjs [--hikashop=/path/to/hikashop]
//
// Writes src/i18n/generated/<tag>.ts, one per locale, plus an index of what was covered.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const arg = (name, fallback) => {
	const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : fallback;
};

const HIKASHOP = arg('hikashop', join(process.cwd(), '..', 'hikashop'));
const LANG_DIR = join(HIKASHOP, 'language');
const OUT_DIR = join(process.cwd(), 'src', 'i18n', 'generated');

if (!existsSync(LANG_DIR)) {
	console.error(`No HikaShop language folder at ${LANG_DIR}. Pass --hikashop=/path/to/hikashop.`);
	process.exit(1);
}

// ---- read the app's English catalogue, which is the list of what needs saying ---------------
function readAppStrings(path) {
	const src = readFileSync(path, 'utf8');
	const out = {};
	const re = /^\t'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*,\s*$/gm;
	let m;
	while ((m = re.exec(src))) out[m[1]] = (m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\"/g, '"');
	return out;
}

function readIni(path) {
	const out = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		const m = /^([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
		if (m) out[m[1]] = m[2];
	}
	return out;
}

// A string with its placeholders and punctuation removed, for matching English to English.
const norm = (v) => v.replace(/\{[^}]*\}/g, '').replace(/%[sd]|%\d\$s/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

const app = readAppStrings(join('src', 'i18n', 'en.ts'));
const enGb = readIni(join(LANG_DIR, 'en-GB.com_hikashop.ini'));

// English -> HikaShop key, so an app string can find its counterpart.
//
// Several keys often share the same English (PRODUCT, PRODUCTS, PRODUCTS_SEARCH), and their
// translations differ, so the choice cannot be "whichever came first in the file": that would
// change the app's German because somebody reordered an .ini. Shortest key name wins, then
// alphabetical, which picks the plain one over the qualified one and is stable.
const byEnglish = new Map();
for (const [k, v] of Object.entries(enGb).sort(([a], [b]) => a.length - b.length || a.localeCompare(b))) {
	const n = norm(v);
	if (n && !byEnglish.has(n)) byEnglish.set(n, k);
}

// The map the app is built from: app key -> HikaShop key. Automatic where the English is the
// same word for the same thing, plus the hand-written pairs in hikashop-keys.json for the ones
// HikaShop words differently.
const manual = JSON.parse(readFileSync(join('src', 'i18n', 'hikashop-keys.json'), 'utf8'));
delete manual._comment;
const mapping = {};
for (const [appKey, english] of Object.entries(app)) {
	const hit = manual[appKey] ?? byEnglish.get(norm(english));
	if (hit && enGb[hit] !== undefined) mapping[appKey] = hit;
}

// HikaShop writes its placeholders as %s and %1$s; the app writes {name}. A string whose
// placeholders cannot be lined up is left out rather than shipped broken.
function convert(appEnglish, translated) {
	const names = [...appEnglish.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
	const holes = (translated.match(/%[sd]|%\d\$s/g) ?? []).length;
	if (names.length === 0) return holes === 0 ? translated : null;
	if (holes !== names.length) return null;
	let i = 0;
	const numbered = /%(\d)\$s/.test(translated);
	return translated.replace(/%[sd]|%(\d)\$s/g, (_, pos) => {
		const name = numbered && pos ? names[Number(pos) - 1] : names[i++];
		return name ? `{${name}}` : '';
	});
}

// ---- write one catalogue per locale ---------------------------------------------------------
const files = readdirSync(LANG_DIR).filter((f) => f.endsWith('.com_hikashop.ini') && !f.includes('_config'));
const tags = files.map((f) => basename(f, '.com_hikashop.ini')).sort();

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const report = [];
const RTL = new Set(['ar', 'he', 'fa', 'ur']);
const display = new Intl.DisplayNames(['en'], { type: 'language' });

for (const tag of tags) {
	// English is the app's own catalogue, hand written; French too. They are not generated.
	if (tag.startsWith('en-')) continue;
	const dict = readIni(join(LANG_DIR, `${tag}.com_hikashop.ini`));
	const out = {};
	for (const [appKey, hikaKey] of Object.entries(mapping)) {
		const translated = dict[hikaKey];
		if (translated === undefined || translated === '') continue;
		// Untranslated entries are common: the file keeps the English. No point shipping those.
		if (translated === enGb[hikaKey]) continue;
		const converted = convert(app[appKey], translated);
		if (converted !== null) out[appKey] = converted;
	}
	// Hand-written translations, for what HikaShop has no word for. They are the source of truth
	// and win over the derived ones, and living in their own file means regenerating never throws
	// them away.
	const manualPath = join('src', 'i18n', 'manual', `${tag}.json`);
	if (existsSync(manualPath)) {
		const extra = JSON.parse(readFileSync(manualPath, 'utf8'));
		delete extra._comment;
		for (const [k, v] of Object.entries(extra)) if (v) out[k] = v;
	}

	if (Object.keys(out).length < 20) continue; // a catalogue that says nothing is noise

	const short = tag.split('-')[0];
	const lines = Object.entries(out)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([k, v]) => `\t'${k}': ${JSON.stringify(v)},`)
		.join('\n');

	writeFileSync(join(OUT_DIR, `${tag}.ts`), `// Generated by tools/build-locales.mjs from HikaShop's ${tag} translation and
// src/i18n/manual/${tag}.json. Do not edit: run the generator again instead. Anything still
// missing falls back to English, per string.
import type { Messages } from '../en';

export const messages: Partial<Messages> = {
${lines}
};
`);
	report.push({ tag, short, rtl: RTL.has(short), count: Object.keys(out).length });
}

// The registry the app reads: every locale, its name in its own language, and how to load it.
const nativeName = (tag) => {
	try {
		return new Intl.DisplayNames([tag], { type: 'language' }).of(tag.split('-')[0]) ?? tag;
	} catch { return tag; }
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const region = (tag) => {
	try {
		return new Intl.DisplayNames(['en'], { type: 'region' }).of(tag.split('-')[1] ?? '') ?? '';
	} catch { return ''; }
};

// Two catalogues can be the same language in different places (de-DE and de-AT). Both are kept,
// named by their region, since a merchant picks the one their shop speaks.
const byLang = {};
for (const r of report) (byLang[r.short] ??= []).push(r);

const entries = report.map((r) => {
	const many = byLang[r.short].length > 1;
	const label = many ? `${cap(nativeName(r.tag))} (${region(r.tag)})` : cap(nativeName(r.tag));
	return `\t'${r.tag}': { name: ${JSON.stringify(label)}, english: ${JSON.stringify(display.of(r.short) ?? r.short)}, ${r.rtl ? 'rtl: true, ' : ''}load: () => import('./${r.tag}').then((m) => m.messages) },`;
}).join('\n');

writeFileSync(join(OUT_DIR, 'index.ts'), `// Generated by tools/build-locales.mjs. Do not edit.
//
// Every language HikaShop is translated into, loaded on demand: a merchant reads one of them,
// and bundling sixty would cost every merchant the other fifty-nine.
import type { Messages } from '../en';

export interface GeneratedLocale {
	/** The language's name in its own language, as it appears in the picker. */
	name: string;
	/** Its name in English, for anyone reading the code. */
	english: string;
	rtl?: boolean;
	load: () => Promise<Partial<Messages>>;
}

export const GENERATED: Record<string, GeneratedLocale> = {
${entries}
};
`);

const total = Object.keys(app).length;
console.log(`app strings:        ${total}`);
console.log(`mapped to HikaShop: ${Object.keys(mapping).length} (${Math.round(100 * Object.keys(mapping).length / total)}%)`);
console.log(`locales written:    ${report.length}`);
const avg = Math.round(report.reduce((s, r) => s + r.count, 0) / (report.length || 1));
console.log(`average per locale: ${avg} strings translated, the rest falls back to English`);
const worst = [...report].sort((a, b) => a.count - b.count).slice(0, 3);
console.log(`thinnest:           ${worst.map((r) => `${r.tag} (${r.count})`).join(', ')}`);
