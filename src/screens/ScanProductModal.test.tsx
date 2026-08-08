// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import { StoreContext } from '../app/store-context';
import { ScanProductModal } from './ScanProductModal';
import { ApiError } from '../core';
import type { ApiClient } from '../core';

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

function renderModal(client: Partial<ApiClient>) {
	const onOpen = vi.fn();
	const value = { client, active: { id: 's1' }, ready: true } as unknown as NonNullable<React.ContextType<typeof StoreContext>>;
	render(
		<I18nProvider>
			<StoreContext.Provider value={value}>
				<ScanProductModal onClose={vi.fn()} onOpen={onOpen} />
			</StoreContext.Provider>
		</I18nProvider>,
	);
	return { onOpen };
}

// jsdom has no BarcodeDetector, so the modal opens on the manual/wedge path -- the same resolve()
// a camera read goes through.
describe('ScanProductModal', () => {
	it('keeps the scanned code visible when nothing matches', async () => {
		const lookupBarcode = vi.fn().mockRejectedValue(new ApiError('not_found', 'nope', 404));
		renderModal({ lookupBarcode } as Partial<ApiClient>);

		const input = screen.getByRole('textbox') as HTMLInputElement;
		fireEvent.change(input, { target: { value: '4991803430612' } });
		fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => expect(screen.getByText(/No product matches/i)).toBeTruthy());
		// The code used to be cleared, which hid what had actually been read and forced a re-scan.
		expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('4991803430612');
	});

	it('shows the match with its stock ready to edit', async () => {
		const lookupBarcode = vi.fn().mockResolvedValue({
			id: 30, variant_id: 0, name: 'SL Test Product', code: 'SL-TEST-001', gtin: '4991803430612', quantity: 7,
		});
		const { onOpen } = renderModal({ lookupBarcode } as Partial<ApiClient>);

		fireEvent.change(screen.getByRole('textbox'), { target: { value: '4991803430612' } });
		fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

		await waitFor(() => expect(screen.getByText('SL Test Product')).toBeTruthy());
		expect(screen.getByText(/SL-TEST-001/)).toBeTruthy();
		expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('7');

		fireEvent.click(screen.getByRole('button', { name: /open product/i }));
		expect(onOpen).toHaveBeenCalledWith(30);
	});

	it('writes the new stock through the client', async () => {
		const lookupBarcode = vi.fn().mockResolvedValue({
			id: 30, variant_id: 0, name: 'P', code: 'C', gtin: '1', quantity: 0,
		});
		const setProductStock = vi.fn().mockResolvedValue({ id: 30, quantity: 12 });
		renderModal({ lookupBarcode, setProductStock } as Partial<ApiClient>);

		fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });
		fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
		await waitFor(() => expect(screen.getByRole('spinbutton')).toBeTruthy());

		fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });
		fireEvent.click(screen.getByRole('button', { name: /update stock/i }));

		await waitFor(() => expect(setProductStock).toHaveBeenCalledWith(30, 12));
	});
});
