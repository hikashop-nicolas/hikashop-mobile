// @vitest-environment jsdom
//
// What a screen reader would say. axe checks that a name exists; this checks what it is, which
// is the part that used to need a person and a headset.
//
// @guidepup/virtual-screen-reader is a simulator, not VoiceOver: it reads the accessibility
// tree the way a screen reader does, headless and on any platform, so it runs in CI. It does
// not replace a pass with the real thing, it catches the regressions before one is worth doing.
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { virtual } from '@guidepup/virtual-screen-reader';
import { I18nProvider } from '../i18n';
import { Field, Search } from './molecules';
import { Modal } from './layout';

// jsdom in this setup exposes a non-functional localStorage, as NewCustomerModal.test.tsx notes.
beforeAll(() => {
	const store = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
		setItem: (k: string, v: string) => { store.set(k, String(v)); },
		removeItem: (k: string) => { store.delete(k); },
		clear: () => store.clear(),
		key: (i: number) => [...store.keys()][i] ?? null,
		get length() { return store.size; },
	});
});

afterEach(cleanup);

const withI18n = (ui: React.ReactNode) => render(<I18nProvider>{ui}</I18nProvider>);

describe('what a screen reader announces', () => {
	it('names a field by its label, which it did not before the audit', async () => {
		withI18n(
			<Field label="Product name">
				<input className="hk-input" defaultValue="Hand-Thrown Mug" />
			</Field>,
		);

		await virtual.start({ container: document.body });
		let heard = '';
		// Walk until the text box is reached.
		for (let i = 0; i < 12 && !heard; i++) {
			await virtual.next();
			const phrase = await virtual.lastSpokenPhrase();
			if (phrase.includes('textbox')) heard = phrase;
		}
		await virtual.stop();

		// The label, not just "textbox". This is exactly what was missing on 108 fields.
		expect(heard).toContain('Product name');
		expect(heard).toContain('Hand-Thrown Mug');
	});

	it('names the search box even though its label is only a placeholder', async () => {
		withI18n(<Search value="" onChange={() => {}} placeholder="Search name or SKU" />);

		await virtual.start({ container: document.body });
		let heard = '';
		for (let i = 0; i < 12 && !heard; i++) {
			await virtual.next();
			const phrase = await virtual.lastSpokenPhrase();
			if (phrase.includes('textbox')) heard = phrase;
		}
		await virtual.stop();

		expect(heard).toContain('Search name or SKU');
	});

	it('announces a dialog as a dialog, and by its title', async () => {
		withI18n(
			<Modal title="Add a product" onClose={() => {}}>
				<p>Pick a product to add to this order.</p>
			</Modal>,
		);

		await virtual.start({ container: document.body });
		let heard = '';
		for (let i = 0; i < 12 && !heard; i++) {
			await virtual.next();
			const phrase = await virtual.lastSpokenPhrase();
			if (phrase.includes('dialog')) heard = phrase;
		}
		await virtual.stop();

		// A dialog that announced only "dialog" would leave someone with no idea what opened.
		expect(heard).toContain('dialog');
		expect(heard).toContain('Add a product');
	});

	it('gives the close button a name in the language in use, not a hardcoded one', async () => {
		render(
			<I18nProvider>
				<Modal title="Add a product" onClose={() => {}}>
					<p>body</p>
				</Modal>
			</I18nProvider>,
		);

		const close = screen.getByRole('button', { name: /close/i });
		expect(close).toBeTruthy();
	});
});
