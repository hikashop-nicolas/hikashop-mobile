// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider } from '../i18n';
import { StoreContext } from '../app/store-context';
import { NewCustomerModal } from './NewCustomerModal';
import type { ApiClient } from '../core';

// Render a screen with English i18n and a mock store context exposing just the fake client.
function renderWithClient(client: Partial<ApiClient>, ui: (props: { onClose: () => void; onCreated: (id: number) => void }) => ReactElement) {
	const onClose = vi.fn();
	const onCreated = vi.fn();
	const value = { client, active: { id: 's1' }, ready: true } as unknown as NonNullable<React.ContextType<typeof StoreContext>>;
	render(
		<I18nProvider>
			<StoreContext.Provider value={value}>{ui({ onClose, onCreated })}</StoreContext.Provider>
		</I18nProvider>,
	);
	return { onClose, onCreated };
}

// jsdom in this setup exposes a non-functional localStorage; back it with a simple in-memory store.
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

describe('NewCustomerModal', () => {
	it('requires an email: shows an error and does not call the API', () => {
		const createCustomer = vi.fn();
		const { onCreated } = renderWithClient({ createCustomer } as Partial<ApiClient>, (p) => <NewCustomerModal {...p} />);

		fireEvent.click(screen.getByRole('button', { name: /create/i }));

		expect(createCustomer).not.toHaveBeenCalled();
		expect(onCreated).not.toHaveBeenCalled();
		expect(screen.getByText(/email address is required/i)).toBeTruthy();
	});

	it('creates the customer and reports the new id', async () => {
		const createCustomer = vi.fn().mockResolvedValue({ id: 77 });
		const { onCreated } = renderWithClient({ createCustomer } as Partial<ApiClient>, (p) => <NewCustomerModal {...p} />);

		const [nameInput, emailInput] = screen.getAllByRole('textbox') as HTMLInputElement[];
		fireEvent.change(nameInput, { target: { value: 'Marie Dupont' } });
		fireEvent.change(emailInput, { target: { value: 'marie@example.com' } });
		fireEvent.click(screen.getByRole('button', { name: /create/i }));

		await waitFor(() => expect(onCreated).toHaveBeenCalledWith(77));
		expect(createCustomer).toHaveBeenCalledWith({ email: 'marie@example.com', name: 'Marie Dupont' });
	});

	it('sends no name when the name is left blank', async () => {
		const createCustomer = vi.fn().mockResolvedValue({ id: 5 });
		renderWithClient({ createCustomer } as Partial<ApiClient>, (p) => <NewCustomerModal {...p} />);

		const [, emailInput] = screen.getAllByRole('textbox') as HTMLInputElement[];
		fireEvent.change(emailInput, { target: { value: 'guest@example.com' } });
		fireEvent.click(screen.getByRole('button', { name: /create/i }));

		await waitFor(() => expect(createCustomer).toHaveBeenCalledWith({ email: 'guest@example.com', name: undefined }));
	});
});
