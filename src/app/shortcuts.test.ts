// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ShortcutMatcher, isTyping, SHORTCUTS } from './shortcuts';

describe('ShortcutMatcher', () => {
	it('matches a single key', () => {
		const m = new ShortcutMatcher();
		expect(m.press('/')?.keys).toBe('/');
		expect(m.press('n')?.keys).toBe('n');
	});

	it('matches a two-key sequence', () => {
		const m = new ShortcutMatcher();
		expect(m.press('g')).toBeNull();
		expect(m.waiting).toBe('g');
		expect(m.press('p')?.keys).toBe('g p');
		expect(m.waiting).toBe('');
	});

	it('forgets a leading key that goes nowhere', () => {
		const m = new ShortcutMatcher();
		m.press('g');
		expect(m.press('z')).toBeNull();
		// The next press starts fresh rather than being read as the tail of "g".
		expect(m.press('/')?.keys).toBe('/');
	});

	it('forgets a leading key after the timeout, so a stray g does not swallow the next key', () => {
		let now = 0;
		const m = new ShortcutMatcher(1200, () => now);
		m.press('g');
		now = 5000;
		// "o" alone is not a shortcut, and must not be read as "g o" five seconds later.
		expect(m.press('o')).toBeNull();
	});

	it('has no shortcut that is also the start of another, which would be ambiguous', () => {
		const singles = SHORTCUTS.filter((s) => !s.keys.includes(' ')).map((s) => s.keys);
		const leaders = new Set(SHORTCUTS.filter((s) => s.keys.includes(' ')).map((s) => s.keys.split(' ')[0]));
		for (const k of singles) expect(leaders.has(k), `"${k}" is both a shortcut and a prefix`).toBe(false);
	});

	it('has no duplicate bindings', () => {
		const keys = SHORTCUTS.map((s) => s.keys);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe('isTyping', () => {
	const el = (tag: string, editable = false) => {
		const e = document.createElement(tag);
		if (editable) e.setAttribute('contenteditable', 'true');
		return e;
	};

	it('is true in the controls where a key means text', () => {
		expect(isTyping(el('input'))).toBe(true);
		expect(isTyping(el('textarea'))).toBe(true);
		expect(isTyping(el('select'))).toBe(true);
	});

	it('is true in a rich text area, which is a div', () => {
		const d = el('div');
		Object.defineProperty(d, 'isContentEditable', { value: true });
		expect(isTyping(d)).toBe(true);
	});

	it('is false elsewhere', () => {
		expect(isTyping(el('button'))).toBe(false);
		expect(isTyping(el('div'))).toBe(false);
		expect(isTyping(null)).toBe(false);
	});
});
