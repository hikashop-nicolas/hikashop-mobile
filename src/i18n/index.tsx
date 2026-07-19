import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { en } from './en';
import { fr } from './fr';
import type { Messages } from './en';

export type { Messages } from './en';
export type TParams = Record<string, string | number>;
export type TFunc = (key: string, params?: TParams) => string;

// Registered locales. Add a catalog here and it appears in the language picker automatically.
export const LOCALES: Record<string, { name: string; messages: Messages }> = {
	en: { name: 'English', messages: en },
	fr: { name: 'Français', messages: fr },
};

const DEFAULT_LOCALE = 'en';
const LOCALE_KEY = 'hk.locale';

// Choose the starting locale: a stored choice wins, else the browser language if we have it.
export function resolveLocale(stored: string | null): string {
	if (stored && LOCALES[stored]) return stored;
	const nav = typeof navigator !== 'undefined' && navigator.language ? navigator.language.slice(0, 2).toLowerCase() : '';
	return LOCALES[nav] ? nav : DEFAULT_LOCALE;
}

function interpolate(s: string, params?: TParams): string {
	if (!params) return s;
	return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

// Resolve a key for a locale: plural-aware (via a `count` param and `.one`/`.other` keys),
// falling back to the plain key, then to English, then to the key string itself.
export function translate(locale: string, key: string, params?: TParams): string {
	const msgs = LOCALES[locale]?.messages ?? en;
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

	useEffect(() => {
		if (typeof document !== 'undefined') document.documentElement.lang = locale;
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
