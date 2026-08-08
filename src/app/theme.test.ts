// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readStoredTheme, applyTheme, isThemeChoice } from './theme';

describe('readStoredTheme', () => {
	it('accepts the three valid choices', () => {
		expect(readStoredTheme('auto')).toBe('auto');
		expect(readStoredTheme('light')).toBe('light');
		expect(readStoredTheme('dark')).toBe('dark');
	});
	it('falls back to following the device', () => {
		expect(readStoredTheme(null)).toBe('auto');
		expect(readStoredTheme('')).toBe('auto');
		expect(readStoredTheme('solarized')).toBe('auto'); // e.g. a value from a later version
	});
});

describe('isThemeChoice', () => {
	it('rejects anything else', () => {
		expect(isThemeChoice('dark')).toBe(true);
		expect(isThemeChoice('nope')).toBe(false);
		expect(isThemeChoice(null)).toBe(false);
	});
});

describe('applyTheme', () => {
	it('pins the attribute the tokens key off', () => {
		const root = document.createElement('html');
		applyTheme('dark', root);
		expect(root.dataset.theme).toBe('dark');
		applyTheme('light', root);
		expect(root.dataset.theme).toBe('light');
	});
	it('removes the attribute for auto, so the media query decides again', () => {
		const root = document.createElement('html');
		applyTheme('dark', root);
		applyTheme('auto', root);
		expect(root.dataset.theme).toBeUndefined();
		expect(root.hasAttribute('data-theme')).toBe(false);
	});
});
