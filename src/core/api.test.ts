import { describe, it, expect } from 'vitest';
import { ApiClient } from './api';
import type { FetchLike } from './api';

const jsonResponse = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const respondWith = (body: unknown, status = 200): FetchLike => async () => jsonResponse(body, status);

describe('ApiClient', () => {
	it('getSite returns the envelope data', async () => {
		const site = { app: 'hikashop-connector', cms: { name: 'joomla' } };
		const c = new ApiClient('http://x', 'tok', respondWith({ data: site, meta: null, error: null }));
		expect((await c.getSite()).cms.name).toBe('joomla');
	});

	it('getOrders maps meta into pagination', async () => {
		const c = new ApiClient('http://x', 'tok', respondWith({ data: [{ id: 1 }], meta: { total: 16, start: 0, limit: 3 }, error: null }));
		const p = await c.getOrders({ limit: 3 });
		expect(p.total).toBe(16);
		expect(p.items.length).toBe(1);
		expect(p.limit).toBe(3);
	});

	it('throws ApiError on an error envelope, carrying code + status', async () => {
		const c = new ApiClient('http://x', null, respondWith({ data: null, error: { code: 'unauthorized', message: 'no' } }, 401));
		await expect(c.getSite()).rejects.toMatchObject({ name: 'ApiError', code: 'unauthorized', status: 401 });
	});

	it('sends the bearer token and builds the index.php URL', async () => {
		let seenUrl = '';
		let seenAuth: string | undefined;
		const fetchFn: FetchLike = async (url, init) => {
			seenUrl = url;
			seenAuth = (init?.headers as Record<string, string>)?.Authorization;
			return jsonResponse({ data: {}, meta: null });
		};
		await new ApiClient('http://shop/', 'ABC', fetchFn).getSite();
		expect(seenUrl).toBe('http://shop/index.php/hikashop-api/v1/site');
		expect(seenAuth).toBe('Bearer ABC');
	});

	it('getOrders builds a query string from filters', async () => {
		let seenUrl = '';
		const fetchFn: FetchLike = async (url) => {
			seenUrl = url;
			return jsonResponse({ data: [], meta: { total: 0 } });
		};
		await new ApiClient('http://shop', 't', fetchFn).getOrders({ limit: 20, status: 'confirmed', search: '' });
		expect(seenUrl).toContain('limit=20');
		expect(seenUrl).toContain('status=confirmed');
		expect(seenUrl).not.toContain('search='); // empty filters are dropped
	});

	it('pair posts code + device_name and returns the token (no auth header)', async () => {
		let seenBody: Record<string, string> = {};
		let hadAuth = false;
		const fetchFn: FetchLike = async (_url, init) => {
			seenBody = JSON.parse(String(init?.body));
			hadAuth = 'Authorization' in ((init?.headers as Record<string, string>) ?? {});
			return jsonResponse({ data: { token: 'T', scopes: ['read'], device_id: 5 }, meta: null });
		};
		const r = await ApiClient.pair('http://shop', 'K7P-4M2-9RX', 'Pixel', 'android', fetchFn);
		expect(r.token).toBe('T');
		expect(seenBody.code).toBe('K7P-4M2-9RX');
		expect(seenBody.device_name).toBe('Pixel');
		expect(hadAuth).toBe(false);
	});

	it('setOrderStatus posts the status/notify/reason and returns the result', async () => {
		let seenUrl = '';
		let seenBody: Record<string, unknown> = {};
		const fetchFn: FetchLike = async (url, init) => {
			seenUrl = url;
			seenBody = JSON.parse(String(init?.body));
			return jsonResponse({ data: { id: 5, status: 'shipped', changed: true, notified: true }, meta: null });
		};
		const r = await new ApiClient('http://shop', 'tok', fetchFn).setOrderStatus(5, 'shipped', { notify: true, reason: 'Sent' });
		expect(seenUrl).toBe('http://shop/index.php/hikashop-api/v1/orders/5/status');
		expect(seenBody).toEqual({ status: 'shipped', notify: true, reason: 'Sent' });
		expect(r.changed).toBe(true);
		expect(r.notified).toBe(true);
	});

	it('getProducts maps meta into pagination and builds the search query', async () => {
		let seenUrl = '';
		const fetchFn: FetchLike = async (url) => {
			seenUrl = url;
			return jsonResponse({ data: [{ id: 1 }], meta: { total: 4, start: 0, limit: 30 } });
		};
		const p = await new ApiClient('http://shop', 't', fetchFn).getProducts({ search: 'shirt', limit: 30 });
		expect(seenUrl).toContain('products?');
		expect(seenUrl).toContain('search=shirt');
		expect(p.total).toBe(4);
		expect(p.items.length).toBe(1);
	});

	it('setProductStock posts the quantity to the stock endpoint', async () => {
		let seenUrl = '';
		let seenBody: Record<string, unknown> = {};
		const fetchFn: FetchLike = async (url, init) => {
			seenUrl = url;
			seenBody = JSON.parse(String(init?.body));
			return jsonResponse({ data: { id: 7, quantity: -1 }, meta: null });
		};
		const r = await new ApiClient('http://shop', 't', fetchFn).setProductStock(7, -1);
		expect(seenUrl).toBe('http://shop/index.php/hikashop-api/v1/products/7/stock');
		expect(seenBody).toEqual({ quantity: -1 });
		expect(r.quantity).toBe(-1);
	});

	it('wraps a transport failure as ApiError(network)', async () => {
		const fetchFn: FetchLike = async () => {
			throw new Error('boom');
		};
		await expect(new ApiClient('http://x', 't', fetchFn).getSite()).rejects.toMatchObject({ code: 'network' });
	});

	// Regression: the default transport must call the global fetch with the global as receiver.
	// Storing native fetch and invoking it as this.fetchFn(...) passes the ApiClient as `this`,
	// which the real fetch rejects with "Illegal invocation" (every request failed as 'network').
	it('default transport calls global fetch with the correct receiver', async () => {
		const realFetch = globalThis.fetch;
		const receivers: unknown[] = [];
		globalThis.fetch = function (this: unknown) {
			receivers.push(this);
			return Promise.resolve(jsonResponse({ data: { app: 'x' }, meta: null }));
		} as typeof fetch;
		try {
			await new ApiClient('http://shop', 'tok').getSite(); // no fetchFn -> default transport
		} finally {
			globalThis.fetch = realFetch;
		}
		expect(receivers.length).toBe(1);
		expect(receivers[0] === undefined || receivers[0] === globalThis).toBe(true);
	});
});
