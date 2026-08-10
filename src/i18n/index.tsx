import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { en } from './en';
import { fr } from './fr';
import { GENERATED } from './generated';
import type { Messages } from './en';

export type { Messages } from './en';
export type TParams = Record<string, string | number>;
export type TFunc = (key: string, params?: TParams) => string;

export interface LocaleDef {
	/** Its name in its own language, which is how a picker should list it. */
	name: string;
	rtl?: boolean;
	/** Present for the two catalogues written by hand; the rest arrive through load(). */
	messages?: Messages;
	load?: () => Promise<Partial<Messages>>;
}

// English and French are written here and are always in the bundle: English because everything
// falls back to it, French because it is the second one we maintain. The other 56 are built
// from HikaShop's own translations and fetched when chosen, since a merchant reads one of them
// and bundling them all would cost every merchant the other 55.
export const LOCALES: Record<string, LocaleDef> = {
	en: { name: 'English', messages: en },
	fr: { name: 'Français', messages: fr },
	...GENERATED,
};

// Catalogues that have arrived, by tag.
const loaded: Record<string, Partial<Messages>> = { en, fr };

export async function loadLocale(tag: string): Promise<void> {
	if (loaded[tag]) return;
	const def = LOCALES[tag];
	if (!def?.load) return;
	try {
		loaded[tag] = await def.load();
	} catch {
		// A catalogue that will not load is not worth failing over: English still reads.
		loaded[tag] = {};
	}
}

const DEFAULT_LOCALE = 'en';
const LOCALE_KEY = 'hk.locale';

// Choose the starting locale: a stored choice wins, then the browser's, which is matched on the
// full tag first (de-AT before de-DE for an Austrian) and then on the language alone.
export function resolveLocale(stored: string | null): string {
	if (stored && LOCALES[stored]) return stored;
	const nav = typeof navigator !== 'undefined' && navigator.language ? navigator.language : '';
	if (!nav) return DEFAULT_LOCALE;
	const exact = Object.keys(LOCALES).find((t) => t.toLowerCase() === nav.toLowerCase());
	if (exact) return exact;
	const short = nav.slice(0, 2).toLowerCase();
	if (LOCALES[short]) return short;
	return Object.keys(LOCALES).find((t) => t.split('-')[0].toLowerCase() === short) ?? DEFAULT_LOCALE;
}

function interpolate(s: string, params?: TParams): string {
	if (!params) return s;
	return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

// Resolve a key for a locale: plural-aware (via a `count` param and `.one`/`.other` keys),
// falling back to the plain key, then to English, then to the key string itself.
export function translate(locale: string, key: string, params?: TParams): string {
	const msgs = LOCALES[locale]?.messages ?? loaded[locale] ?? en;
	let raw: string | undefined;

	if (params && typeof params.count === 'number') {
		const cat = new Intl.PluralRules(locale).select(params.count);
		raw = msgs[`${key}.${cat}`] ?? msgs[`${key}.other`] ?? en[`${key}.${cat}`] ?? en[`${key}.other`];
	}
	if (raw === undefined) raw = msgs[key] ?? en[key] ?? key;
	return interpolate(raw, params);
}

interface I18nValue {
	locale: string;
	setLocale: (l: string) => void;
	t: TFunc;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState(() =>
		resolveLocale(typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_KEY) : null),
	);

	// Bumped when a catalogue arrives, so everything showing English re-renders in its language.
	const [, setReady] = useState(0);

	useEffect(() => {
		if (typeof document === 'undefined') return;
		document.documentElement.lang = locale;
		// Arabic, Hebrew and Persian read right to left, and the whole layout follows from this
		// one attribute: flex rows, text alignment, and which side a chevron points.
		document.documentElement.dir = LOCALES[locale]?.rtl ? 'rtl' : 'ltr';
	}, [locale]);

	useEffect(() => {
		let alive = true;
		void loadLocale(locale).then(() => { if (alive) setReady((n) => n + 1); });
		return () => { alive = false; };
	}, [locale]);

	const setLocale = useCallback((l: string) => {
		if (!LOCALES[l]) return;
		localStorage.setItem(LOCALE_KEY, l);
		setLocaleState(l);
	}, []);

	const t = useCallback<TFunc>((key, params) => translate(locale, key, params), [locale]);

	return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
	const ctx = useContext(I18nContext);
	if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
	return ctx;
}

export function useT(): TFunc {
	return useI18n().t;
}

// Translate an error code (e.g. ApiError.code) to a message, falling back to a generic one
// when there is no specific key for that code.
export function tError(t: TFunc, code: string): string {
	if (!code) return '';
	const key = `error.${code}`;
	const msg = t(key);
	return msg === key ? t('error.generic') : msg;
}
