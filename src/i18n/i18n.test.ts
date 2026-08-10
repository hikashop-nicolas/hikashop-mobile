import { describe, it, expect } from 'vitest';
import { translate, resolveLocale, tError, LOCALES } from './index';
import { en } from './en';
import { fr } from './fr';

describe('i18n', () => {
	it('translates a key for the active locale', () => {
		expect(translate('en', 'tabs.orders')).toBe('Orders');
		expect(translate('fr', 'tabs.orders')).toBe('Commandes');
	});

	it('interpolates named params', () => {
		expect(translate('en', 'orders.countOf', { shown: 3, total: 16 })).toBe('3 of 16');
		expect(translate('fr', 'orders.countOf', { shown: 3, total: 16 })).toBe('3 sur 16');
	});

	it('selects plural forms by count', () => {
		expect(translate('fr', 'dashboard.sold', { count: 1 })).toBe('1 vendu');
		expect(translate('fr', 'dashboard.sold', { count: 5 })).toBe('5 vendus');
	});

	it('falls back to English, then to the key, for a missing translation', () => {
		expect(translate('fr', 'nonexistent.key')).toBe('nonexistent.key');
		// A locale that is not registered falls back to the English catalog.
		expect(translate('zz', 'tabs.stores')).toBe('Stores');
	});

	it('resolveLocale honours a stored choice, else falls back to the default', () => {
		expect(resolveLocale('fr')).toBe('fr');
		expect(resolveLocale('unsupported')).toBe('en');
	});

	it('tError maps a code to a message and falls back to generic', () => {
		expect(tError((k) => translate('en', k), 'network')).toBe(en['error.network']);
		expect(tError((k) => translate('en', k), 'totally_unknown')).toBe(en['error.generic']);
		expect(tError((k) => translate('en', k), '')).toBe('');
	});

	it('every English key has a French translation (and vice versa)', () => {
		const enKeys = Object.keys(en).sort();
		const frKeys = Object.keys(fr).sort();
		expect(frKeys).toEqual(enKeys);
	});

	// The two written here are the ones this file is about: English because everything falls
	// back to it and French because it is maintained by hand beside it. The other 56 come from
	// HikaShop and are covered by locales.test.ts.
	it('carries the two hand-written catalogues in the bundle', () => {
		expect(LOCALES.en.messages).toBe(en);
		expect(LOCALES.fr.messages).toBe(fr);
		// The rest arrive on demand, so they have a loader instead of messages.
		expect(LOCALES['de-DE'].messages).toBeUndefined();
		expect(typeof LOCALES['de-DE'].load).toBe('function');
	});
});
