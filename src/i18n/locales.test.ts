// @vitest-environment jsdom
//
// The generated catalogues come from HikaShop's language files, so what is worth testing is not
// the translations themselves but that the machinery around them holds: every locale loads,
// nothing shipped is malformed, and a language nobody has translated still reads in English.
import { describe, it, expect } from 'vitest';
import { LOCALES, loadLocale, translate, resolveLocale } from './index';
import { en } from './en';

const tags = Object.keys(LOCALES);

describe('locales', () => {
	it('offers every language HikaShop is translated into', () => {
		// 56 built from HikaShop, plus the two written here.
		expect(tags.length).toBeGreaterThan(50);
		expect(tags).toContain('en');
		expect(tags).toContain('fr');
		expect(tags).toContain('de-DE');
		expect(tags).toContain('ar-AA');
	});

	it('names each one in its own language, not by its tag', () => {
		for (const tag of tags) {
			const name = LOCALES[tag].name;
			expect(name, tag).toBeTruthy();
			expect(name, `${tag} is named after its tag`).not.toBe(tag);
		}
		expect(LOCALES['de-DE'].name).toMatch(/Deutsch/);
	});

	it('marks the right-to-left languages, and only those', () => {
		const rtl = tags.filter((t) => LOCALES[t].rtl);
		expect(rtl.length).toBeGreaterThan(0);
		for (const t of rtl) expect(t.split('-')[0]).toMatch(/^(ar|he|fa|ur)$/);
		expect(LOCALES['de-DE'].rtl).toBeFalsy();
	});

	it('loads every catalogue, and each says something', async () => {
		for (const tag of tags) {
			await loadLocale(tag);
			// Nothing empty and nothing broken: a catalogue that loads but is blank would show
			// as English everywhere and look like a missing language rather than a failure.
			expect(translate(tag, 'tabs.orders'), tag).toBeTruthy();
		}
	});

	it('falls back to English for a string nobody has translated, per string', async () => {
		// A locale that is still partial, found rather than named: naming one means this test
		// breaks the day that language is finished, which is the wrong thing to be told about.
		let partial: string | undefined;
		let untranslated: string | undefined;
		for (const tag of tags) {
			if (tag === 'en') continue;
			await loadLocale(tag);
			const key = Object.keys(en).find((k) => translate(tag, k) === en[k] && en[k].length > 12);
			if (key) { partial = tag; untranslated = key; break; }
		}
		expect(partial, 'every locale is complete, so this test has nothing to check').toBeTruthy();
		// It reads in English rather than showing the key or an empty string.
		expect(translate(partial!, untranslated!)).toBe(en[untranslated!]);
	});

	it('has German complete, since it was translated by hand', async () => {
		await loadLocale('de-DE');
		expect(translate('de-DE', 'tabs.orders')).toBe('Bestellungen');
		const missing = Object.keys(en).filter((k) => !k.endsWith('.one') && !k.endsWith('.other') && translate('de-DE', k) === en[k]);
		// A handful of words are the same in both languages (SEO, GTIN, Alias, Link), which is
		// not a hole; anything beyond that is one.
		expect(missing.length, `untranslated in de-DE: ${missing.join(', ')}`).toBeLessThan(12);
	});

	// Polish counts in three and Russian in four, where English counts in two. A language that
	// only carried English's two would say "5 warianty", which is the kind of wrong that makes an
	// app feel machine-made.
	it('uses the plural forms its language actually has', async () => {
		// English counts in two, one and other. Polish and Russian count in three, so a catalogue
		// that carries only English's two would say "5 warianty" for every count above one.
		// Checked against what ships, not against translate(): a missing .few falls back to English
		// and would otherwise read as a difference rather than as the hole it is.
		const counted = Object.keys(en)
			.filter((k) => k.endsWith('.other'))
			.map((k) => k.slice(0, -'.other'.length));
		for (const tag of ['pl-PL', 'ru-RU']) {
			const { messages } = (await import(`./generated/${tag}.ts`)) as { messages: Record<string, string> };
			// Only checked where the language has been written out here; one still on HikaShop's
			// own strings alone has no plural forms of ours to carry.
			if (!(`${counted[0]}.one` in messages)) continue;
			const cats = [...new Set([1, 2, 5, 22].map((n) => new Intl.PluralRules(tag).select(n)))];
			let distinguishes = 0;
			for (const base of counted) {
				const said = cats.map((c) => {
					expect(`${base}.${c}`, `${tag} is missing ${base}.${c}`).toSatisfy((k: string) => k in messages);
					return messages[`${base}.${c}`];
				});
				if (new Set(said).size === cats.length) distinguishes++;
			}
			// Not every counted string bends: "{count} w magazynie" is right for 1, 2 and 5 alike,
			// since the number governs no noun there. But if none of them bent, the forms would
			// have been duplicated to satisfy the check above rather than translated.
			expect(distinguishes, `${tag} never actually inflects a counted string`).toBeGreaterThan(0);
		}
	});

	it('reads a fuller sibling before falling back to English', async () => {
		// fr-FR and fr-CA carry about a third of the strings each; fr carries all of them. Without
		// a chain, a browser reporting fr-FR matches exactly and the merchant reads mostly English.
		for (const tag of ['fr-FR', 'fr-CA', 'de-AT', 'nl-BE']) {
			await loadLocale(tag);
			const base = LOCALES[tag].base as string;
			expect(base, `${tag} has no fuller sibling`).toBeTruthy();
			const said = translate(tag, 'unsaved.discard');
			expect(said, `${tag} still reads English`).not.toBe(en['unsaved.discard']);
			expect(said).toBe(translate(base, 'unsaved.discard'));
		}
	});

	it('never falls back across alphabets', async () => {
		// Serbian is written in both, and Chinese in two sets of Han characters no letter count can
		// tell apart. Neither may borrow from the other: an alphabet nobody asked for is worse than
		// English.
		for (const tag of ['sr-RS', 'sr-YU', 'zh-CN', 'zh-TW', 'srp-ME']) {
			expect(LOCALES[tag]?.base, `${tag} borrows from another alphabet`).toBeUndefined();
		}
	});

	it('never leaves a placeholder stranded', async () => {
		// A translation carrying {count} where the English does not, or missing one it needs,
		// would render as literal braces to a merchant.
		for (const tag of tags) {
			await loadLocale(tag);
			for (const key of Object.keys(en)) {
				const source = new Set([...en[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
				const out = translate(tag, key);
				for (const hole of [...out.matchAll(/\{(\w+)\}/g)].map((m) => m[1])) {
					expect(source.has(hole), `${tag} ${key} introduces {${hole}}`).toBe(true);
				}
			}
		}
	});

	it('picks a locale from the browser, by full tag before language', () => {
		const nav = (v: string) => Object.defineProperty(window.navigator, 'language', { value: v, configurable: true });
		nav('de-DE');
		expect(resolveLocale(null)).toBe('de-DE');
		// A language we carry only in one region still matches on the language alone.
		nav('de-CH');
		expect(resolveLocale(null)).toMatch(/^de/);
		nav('xx-XX');
		expect(resolveLocale(null)).toBe('en');
		// A stored choice wins over the browser.
		nav('de-DE');
		expect(resolveLocale('fr')).toBe('fr');
	});
});
