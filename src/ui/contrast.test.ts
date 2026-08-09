// Every text colour in the palette, against the grounds it is painted on, must meet WCAG AA.
//
// This is a unit test rather than part of the browser audit because contrast is a property of
// the tokens, not of a rendered page: it can be computed from the stylesheet, it runs in CI
// where the browser audit cannot, and it fails on the commit that changes a colour rather than
// whenever somebody next remembers to run the audit.
//
// The audit of 2026-08-09 found --hk-faint at 2.19:1 where 4.5 is needed, and it had been that
// way for the life of the app.
/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Read from disk rather than through Vite. A `?raw` import of this file resolves to an empty
// module once another test in the same run has pulled the stylesheet in as a stylesheet, and an
// empty palette is a test that passes while checking nothing.

const AA_NORMAL = 4.5;

function luminance(hex: string): number {
	const h = hex.replace('#', '');
	const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
	const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: string, bg: string): number {
	const [a, b] = [luminance(fg), luminance(bg)];
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// The tokens as each theme block defines them. A block that redefines only some tokens
// inherits the rest from the light set, which is how the stylesheet itself works.
function themes(): Record<string, Record<string, string>> {
	const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');
	const out: Record<string, Record<string, string>> = {};

	// Each block, by the selector that opens it.
	const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
	for (const [, selectorRaw, body] of blocks) {
		const selector = selectorRaw.trim().split('\n').pop()!.trim();
		const vars: Record<string, string> = {};
		for (const [, name, value] of body.matchAll(/--(hk-[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
			vars[name] = value;
		}
		if (Object.keys(vars).length === 0) continue;
		const key = selector.includes('dark') ? 'dark' : 'light';
		out[key] = { ...(out[key] ?? {}), ...vars };
	}
	return out;
}

// fg token, bg token, and what it is used for, so a failure says where to look.
const PAIRS: [string, string, string][] = [
	['hk-ink', 'hk-bg', 'body text on the page'],
	['hk-ink', 'hk-surface', 'body text on a card'],
	['hk-muted', 'hk-bg', 'labels and secondary text on the page'],
	['hk-muted', 'hk-surface', 'labels and secondary text on a card'],
	['hk-muted', 'hk-surface-2', 'the neutral status pill'],
	['hk-faint', 'hk-bg', 'hints, chart labels, placeholders'],
	['hk-faint', 'hk-surface', 'hints inside a card'],
	['hk-accent', 'hk-bg', 'links and quiet buttons'],
	['hk-accent', 'hk-surface', 'links inside a card'],
	['hk-accent', 'hk-accent-soft', 'the active chip and tab'],
	['hk-accent-ink', 'hk-accent', 'text on a primary button'],
	['hk-ok', 'hk-ok-soft', 'a confirmed status pill'],
	['hk-warn', 'hk-warn-soft', 'a warning status pill'],
	['hk-crit', 'hk-crit-soft', 'an error status pill'],
];

describe('palette contrast', () => {
	const all = themes();

	for (const theme of ['light', 'dark']) {
		describe(theme, () => {
			for (const [fg, bg, use] of PAIRS) {
				it(`${fg} on ${bg} is readable (${use})`, () => {
					const vars = all[theme];
					expect(vars, `no ${theme} tokens found`).toBeTruthy();
					const a = vars[fg];
					const b = vars[bg];
					expect(a, `--${fg} missing from the ${theme} theme`).toBeTruthy();
					expect(b, `--${bg} missing from the ${theme} theme`).toBeTruthy();
					const r = ratio(a, b);
					expect(
						Number(r.toFixed(2)),
						`--${fg} (${a}) on --${bg} (${b}) is ${r.toFixed(2)}:1, needs ${AA_NORMAL}:1`,
					).toBeGreaterThanOrEqual(AA_NORMAL);
				});
			}
		});
	}
});
