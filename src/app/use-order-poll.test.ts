// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./chime', () => ({ playChime: vi.fn(async () => {}), primeAudio: vi.fn(async () => {}) }));

vi.mock('./notifier', () => ({
	notifier: {
		supported: true,
		permission: () => 'granted',
		requestPermission: async () => true,
		show: vi.fn(async () => {}),
	},
}));

import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { useOrderPoll } from './use-order-poll';
import { notifier } from './notifier';
import { playChime } from './chime';
import { DEFAULT_NOTIFY_SETTINGS } from '../core';
import type { ApiClient, Store, Paginated, OrderSummary, NotifySettings, LowStockItem } from '../core';

const settings = (over: Partial<NotifySettings> = {}): NotifySettings => ({ ...DEFAULT_NOTIFY_SETTINGS, ...over });

const store = { id: 's1', name: 'x', baseUrl: 'http://x', role: 'admin', capabilities: {}, createdAt: 0 } as unknown as Store;

const page = (ids: number[]): Paginated<OrderSummary> => ({
	items: ids.map((id) => ({ id, number: `N${id}`, status: 'confirmed', created: 0, total: id, currency_id: 1, customer: { name: null, email: 'a@b' } } as OrderSummary)),
	total: ids.length,
	start: 0,
	limit: 20,
});

function fakeClient(pages: Paginated<OrderSummary>[], lowStock: LowStockItem[][] = [[]]) {
	let i = 0;
	let j = 0;
	return {
		getOrders: vi.fn(async () => pages[Math.min(i++, pages.length - 1)]),
		getLowStock: vi.fn(async () => lowStock[Math.min(j++, lowStock.length - 1)]),
	} as unknown as ApiClient;
}

// Minimal translator stub: renders the order number into the title.
const tt = (key: string, params?: Record<string, string | number>) =>
	key === 'notify.newOrder' && params ? `New order #${params.number}` : key;

beforeEach(() => {
	const mem = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
		setItem: (k: string, v: string) => { mem.set(k, String(v)); },
		removeItem: (k: string) => { mem.delete(k); },
		clear: () => mem.clear(),
	});
	vi.mocked(notifier.show).mockClear();
	Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(cleanup); // otherwise a previous test's hook keeps polling into the next one

describe('useOrderPoll', () => {
	it('baselines on the first poll, then notifies for a newer order', async () => {
		const client = fakeClient([page([28, 26]), page([30, 28, 26])]);
		renderHook(() => useOrderPoll(client, store, true, tt, settings()));

		await waitFor(() => expect(localStorage.getItem('hk.notify.cursor.s1')).toBe('28'));
		expect(notifier.show).not.toHaveBeenCalled();

		document.dispatchEvent(new Event('visibilitychange')); // trigger a second poll
		await waitFor(() => expect(notifier.show).toHaveBeenCalledTimes(1));
		expect(vi.mocked(notifier.show).mock.calls[0][0].title).toContain('N30');
		expect(localStorage.getItem('hk.notify.cursor.s1')).toBe('30');
	});

	it('plays the chime for a new order', async () => {
		const client = fakeClient([page([28]), page([30, 28])]);
		renderHook(() => useOrderPoll(client, store, true, tt, settings({ sound: true })));
		await waitFor(() => expect(localStorage.getItem('hk.notify.cursor.s1')).toBe('28'));
		document.dispatchEvent(new Event('visibilitychange'));
		await waitFor(() => expect(playChime).toHaveBeenCalledTimes(1));
	});

	it('notifies without a chime when sound is off', async () => {
		const client = fakeClient([page([28]), page([30, 28])]);
		renderHook(() => useOrderPoll(client, store, true, tt, settings({ sound: false })));
		await waitFor(() => expect(localStorage.getItem('hk.notify.cursor.s1')).toBe('28'));
		// Let any straggling poll from an earlier test settle before counting this one's calls.
		await new Promise((r) => setTimeout(r, 30));
		vi.mocked(playChime).mockClear();
		vi.mocked(notifier.show).mockClear();

		document.dispatchEvent(new Event('visibilitychange'));
		await waitFor(() => expect(notifier.show).toHaveBeenCalled());
		expect(playChime).not.toHaveBeenCalled();
	});

	it('notifies for low stock only once per quantity', async () => {
		const low: LowStockItem[] = [{ id: 7, variant_id: 0, name: 'Widget', code: 'W1', quantity: 2 }];
		const client = fakeClient([page([28])], [low, low]);
		renderHook(() => useOrderPoll(client, store, true, tt, settings({ lowStock: true, newOrders: false })));

		await waitFor(() => expect(notifier.show).toHaveBeenCalledTimes(1));
		expect(vi.mocked(notifier.show).mock.calls[0][0].tag).toBe('stock-7');

		// The same quantity on the next poll must not alert again.
		document.dispatchEvent(new Event('visibilitychange'));
		await new Promise((r) => setTimeout(r, 30));
		expect(notifier.show).toHaveBeenCalledTimes(1);
	});

	it('does not check low stock when that alert is off', async () => {
		const client = fakeClient([page([28])]);
		renderHook(() => useOrderPoll(client, store, true, tt, settings({ lowStock: false })));
		await waitFor(() => expect(client.getOrders).toHaveBeenCalled());
		expect(client.getLowStock).not.toHaveBeenCalled();
	});

	it('does not poll when disabled', async () => {
		const client = fakeClient([page([28])]);
		renderHook(() => useOrderPoll(client, store, false, tt, settings()));
		await new Promise((r) => setTimeout(r, 20));
		expect(client.getOrders).not.toHaveBeenCalled();
	});
});
