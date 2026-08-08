import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

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

// The Android theme paints the system bars from a resource, which follows the *device* setting.
// When the app pins its own appearance those two disagree, so tell the platform directly what
// the interface is currently showing. Web has no status bar to set, hence the native guard.
const BAR_BACKGROUND = { light: '#ffffff', dark: '#181d21' };

async function syncStatusBar(root: HTMLElement): Promise<void> {
	if (!Capacitor.isNativePlatform()) return;
	// Read the resolved appearance rather than the choice: "auto" still has to resolve to one.
	const dark = root.dataset.theme
		? root.dataset.theme === 'dark'
		: window.matchMedia('(prefers-color-scheme: dark)').matches;
	try {
		// Style.Light means light *content* (for a dark bar), which reads backwards at a glance.
		await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
		await StatusBar.setBackgroundColor({ color: dark ? BAR_BACKGROUND.dark : BAR_BACKGROUND.light });
	} catch {
		// Not every platform implements both calls; the resource-based colour still applies.
	}
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
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		applyTheme(theme, root);
		void syncStatusBar(root);

		// On "auto" the device can change under us, so follow it while that is the choice.
		if (theme !== 'auto') return;
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = () => { void syncStatusBar(root); };
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
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
