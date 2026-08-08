import { describe, it, expect } from 'vitest';
import { CacheRepository, ordersFilterKey, CACHE_VERSION } from './cache';
import { MemoryKeyValueStore } from './storage';
import type { Paginated, OrderSummary, OrderDetail, DashboardStats } from './models';

const page = (n: number): Paginated<OrderSummary> => ({
	items: Array.from({ length: n }, (_, i) => ({ id: i } as OrderSummary)),
	total: n,
	start: 0,
	limit: 30,
});

const clockAt = (t: number) => new CacheRepository(new MemoryKeyValueStore(), () => t);

describe('CacheRepository', () => {
	it('round-trips orders with a fetchedAt stamp', async () => {
		const c = clockAt(1000);
		await c.putOrders('s1', ordersFilterKey('', ''), page(2));
		const got = await c.getOrders('s1', ordersFilterKey('', ''));
		expect(got?.fetchedAt).toBe(1000);
		expect(got?.data.total).toBe(2);
		expect(got?.data.items.length).toBe(2);
	});

	it('returns null for a miss', async () => {
		const c = clockAt(0);
		expect(await c.getOrders('s1', 'all:')).toBeNull();
		expect(await c.getOrderDetail('s1', 99)).toBeNull();
		expect(await c.getDashboard('s1', 'week')).toBeNull();
	});

	it('namespaces by store id', async () => {
		const kv = new MemoryKeyValueStore();
		const c = new CacheRepository(kv, () => 5);
		await c.putDashboard('s1', 'week', { totals: { revenue: 1 } } as DashboardStats);
		expect(await c.getDashboard('s1', 'week')).not.toBeNull();
		expect(await c.getDashboard('s2', 'week')).toBeNull();
	});

	it('different filters and ranges are separate slots', async () => {
		const c = clockAt(1);
		await c.putOrders('s1', ordersFilterKey('confirmed', ''), page(3));
		await c.putOrders('s1', ordersFilterKey('cancelled', ''), page(1));
		expect((await c.getOrders('s1', ordersFilterKey('confirmed', '')))?.data.total).toBe(3);
		expect((await c.getOrders('s1', ordersFilterKey('cancelled', '')))?.data.total).toBe(1);
	});

	it('clearStore removes only that store, keeping others', async () => {
		const kv = new MemoryKeyValueStore();
		const c = new CacheRepository(kv, () => 1);
		await c.putOrders('s1', 'all:', page(1));
		await c.putOrderDetail('s1', 7, { number: 'A' } as OrderDetail);
		await c.putDashboard('s2', 'year', { totals: {} } as DashboardStats);
		await c.clearStore('s1');
		expect(await c.getOrders('s1', 'all:')).toBeNull();
		expect(await c.getOrderDetail('s1', 7)).toBeNull();
		expect(await c.getDashboard('s2', 'year')).not.toBeNull();
	});

	it('treats corrupt json as a miss', async () => {
		const kv = new MemoryKeyValueStore();
		await kv.set(`v${CACHE_VERSION}.s1.dashboard.week`, '{not json');
		const c = new CacheRepository(kv, () => 1);
		expect(await c.getDashboard('s1', 'week')).toBeNull();
	});

	it('ordersFilterKey is stable and distinguishes inputs', () => {
		expect(ordersFilterKey('', '')).toBe('all:');
		expect(ordersFilterKey('confirmed', '')).toBe('confirmed:');
		expect(ordersFilterKey('', 'abc')).toBe('all:abc');
		expect(ordersFilterKey(undefined, undefined)).toBe('all:');
	});
});

// A store that starts rejecting writes, to model a full quota.
class FullStore extends MemoryKeyValueStore {
	full = false;
	async set(key: string, value: string) {
		if (this.full) throw new Error('QuotaExceededError');
		return super.set(key, value);
	}
}

describe('CacheRepository eviction and write safety', () => {
	it('never rejects when the backing store is full', async () => {
		const kv = new FullStore();
		const c = new CacheRepository(kv, () => 1);
		kv.full = true;
		// The caller awaits this before navigating, so it must resolve rather than throw.
		await expect(c.putOrders('s1', 'all:', page(1))).resolves.toBeTruthy();
	});

	it('still returns the entry when it could not be persisted', async () => {
		const kv = new FullStore();
		const c = new CacheRepository(kv, () => 7);
		kv.full = true;
		const entry = await c.putOrderDetail('s1', 1, { id: 1 } as OrderDetail);
		expect(entry.fetchedAt).toBe(7);
		expect(await c.getOrderDetail('s1', 1)).toBeNull(); // nothing was stored
	});

	it('evicts the oldest entries first', async () => {
		const kv = new MemoryKeyValueStore();
		let t = 0;
		const c = new CacheRepository(kv, () => t);
		t = 100; await c.putOrderDetail('s1', 1, { id: 1 } as OrderDetail); // oldest
		t = 200; await c.putOrderDetail('s1', 2, { id: 2 } as OrderDetail);
		t = 300; await c.putOrderDetail('s1', 3, { id: 3 } as OrderDetail); // newest

		await c.evictOldest(1 / 3);
		expect(await c.getOrderDetail('s1', 1)).toBeNull();
		expect(await c.getOrderDetail('s1', 3)).not.toBeNull();
	});

	it('keeps the translation dictionary, which is expensive to refetch', async () => {
		const kv = new MemoryKeyValueStore();
		const c = new CacheRepository(kv, () => 1);
		await c.putTranslations('s1', 'fr-FR', { locale: 'fr-FR', strings: { A: 'B' } });
		await c.putOrderDetail('s1', 1, { id: 1 } as OrderDetail);

		await c.evictOldest(1); // evict everything evictable
		expect(await c.getOrderDetail('s1', 1)).toBeNull();
		expect(await c.getTranslations('s1', 'fr-FR')).not.toBeNull();
	});

	it('prunes down to a cap, and is a no-op under it', async () => {
		const kv = new MemoryKeyValueStore();
		let t = 0;
		const c = new CacheRepository(kv, () => ++t);
		for (let i = 0; i < 10; i++) await c.putOrderDetail('s1', i, { id: i } as OrderDetail);

		expect(await c.pruneTo(20)).toBe(0);
		await c.pruneTo(4);
		const left = (await kv.keys()).length;
		expect(left).toBeLessThanOrEqual(4);
		expect(await c.getOrderDetail('s1', 9)).not.toBeNull(); // newest survives
	});
});
