import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

// Appearance: follow the device, or pin light/dark. The tokens already define all three cases
// (a prefers-color-scheme block plus :root[data-theme="light"|"dark"] overrides), so pinning is
// just a matter of setting the attribute; "auto" removes it and lets the media query decide.
export type ThemeChoice = 'auto' | 'light' | 'dark';

const THEME_KEY = 'hk.theme';

export function isThemeChoice(v: string | null): v is ThemeChoice {
	return v === 'auto' || v === 'light' || v === 'dark';
}

export function readStoredTheme(raw: string | null): ThemeChoice {
	return isThemeChoice(raw) ? raw : 'auto';
}

// Apply a choice to the document. Exported so it can be unit-tested without React.
export function applyTheme(choice: ThemeChoice, root: HTMLElement): void {
	if (choice === 'auto') delete root.dataset.theme;
	else root.dataset.theme = choice;
}

interface ThemeValue {
	theme: ThemeChoice;
	setTheme: (t: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<ThemeChoice>(
		() => readStoredTheme(typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null),
	);

	useEffect(() => {
		if (typeof document !== 'undefined') applyTheme(theme, document.documentElement);
	}, [theme]);

	const setTheme = useCallback((next: ThemeChoice) => {
		try { localStorage.setItem(THEME_KEY, next); } catch { /* storage full or blocked */ }
		setThemeState(next);
	}, []);

	return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
	const ctx = useContext(ThemeContext);
	if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
	return ctx;
}
