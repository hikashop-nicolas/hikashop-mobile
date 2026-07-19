// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./notifier', () => ({
	notifier: {
		supported: true,
		permission: () => 'granted',
		requestPermission: async () => true,
		show: vi.fn(async () => {}),
	},
}));

import { renderHook, waitFor } from '@testing-library/react';
import { useOrderPoll } from './use-order-poll';
import { notifier } from './notifier';
import type { ApiClient, Store, Paginated, OrderSummary } from '../core';

const store = { id: 's1', name: 'x', baseUrl: 'http://x', role: 'admin', capabilities: {}, createdAt: 0 } as unknown as Store;

const page = (ids: number[]): Paginated<OrderSummary> => ({
	items: ids.map((id) => ({ id, number: `N${id}`, status: 'confirmed', created: 0, total: id, currency_id: 1, customer: { name: null, email: 'a@b' } } as OrderSummary)),
	total: ids.length,
	start: 0,
	limit: 20,
});

function fakeClient(pages: Paginated<OrderSummary>[]) {
	let i = 0;
	return { getOrders: vi.fn(async () => pages[Math.min(i++, pages.length - 1)]) } as unknown as ApiClient;
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

describe('useOrderPoll', () => {
	it('baselines on the first poll, then notifies for a newer order', async () => {
		const client = fakeClient([page([28, 26]), page([30, 28, 26])]);
		renderHook(() => useOrderPoll(client, store, true, tt));

		await waitFor(() => expect(localStorage.getItem('hk.notify.cursor.s1')).toBe('28'));
		expect(notifier.show).not.toHaveBeenCalled();

		document.dispatchEvent(new Event('visibilitychange')); // trigger a second poll
		await waitFor(() => expect(notifier.show).toHaveBeenCalledTimes(1));
		expect(vi.mocked(notifier.show).mock.calls[0][0].title).toContain('N30');
		expect(localStorage.getItem('hk.notify.cursor.s1')).toBe('30');
	});

	it('does not poll when disabled', async () => {
		const client = fakeClient([page([28])]);
		renderHook(() => useOrderPoll(client, store, false, tt));
		await new Promise((r) => setTimeout(r, 20));
		expect(client.getOrders).not.toHaveBeenCalled();
	});
});
