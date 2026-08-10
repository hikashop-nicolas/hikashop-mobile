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
		await loadLocale('de-DE');
		// Translated by HikaShop.
		expect(translate('de-DE', 'tabs.orders')).toBe('Bestellungen');
		// Ours alone, so it reads in English rather than as a key.
		expect(translate('de-DE', 'shortcut.title')).toBe(en['shortcut.title']);
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
