// Cache-then-network read models, namespaced per store_id. Backed by an injectable
// KeyValueStore so the PWA uses browser storage today and native builds can swap in the
// SQLite repository later without touching callers. A version prefix invalidates stale
// shapes on a schema bump until a full migration runner lands (Phase 3 queue/ledger).

import type { KeyValueStore } from './storage';
import type { OrderSummary, OrderDetail, DashboardStats, Paginated, ProductSummary, ProductDetail, ProductMeta } from './models';

export const CACHE_VERSION = 1;

export interface Cached<T> {
	data: T;
	fetchedAt: number;
}

// A stable key for an orders view: same filters -> same cache slot.
export function ordersFilterKey(status?: string, search?: string): string {
	return `${status || 'all'}:${search || ''}`;
}

export class CacheRepository {
	private kv: KeyValueStore;
	private now: () => number;

	constructor(kv: KeyValueStore, now: () => number = () => Date.now()) {
		this.kv = kv;
		this.now = now;
	}

	private key(storeId: string, ...parts: string[]): string {
		return `v${CACHE_VERSION}.${storeId}.${parts.join('.')}`;
	}

	private async read<T>(k: string): Promise<Cached<T> | null> {
		const raw = await this.kv.get(k);
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw) as Cached<T>;
			if (parsed && typeof parsed.fetchedAt === 'number' && 'data' in parsed) return parsed;
			return null;
		} catch {
			return null;
		}
	}

	private async write<T>(k: string, data: T): Promise<Cached<T>> {
		const entry: Cached<T> = { data, fetchedAt: this.now() };
		await this.kv.set(k, JSON.stringify(entry));
		return entry;
	}

	getOrders(storeId: string, filterKey: string): Promise<Cached<Paginated<OrderSummary>> | null> {
		return this.read(this.key(storeId, 'orders', filterKey));
	}
	putOrders(storeId: string, filterKey: string, page: Paginated<OrderSummary>): Promise<Cached<Paginated<OrderSummary>>> {
		return this.write(this.key(storeId, 'orders', filterKey), page);
	}

	getOrderDetail(storeId: string, orderId: number): Promise<Cached<OrderDetail> | null> {
		return this.read(this.key(storeId, 'order', String(orderId)));
	}
	putOrderDetail(storeId: string, orderId: number, detail: OrderDetail): Promise<Cached<OrderDetail>> {
		return this.write(this.key(storeId, 'order', String(orderId)), detail);
	}

	getDashboard(storeId: string, range: string): Promise<Cached<DashboardStats> | null> {
		return this.read(this.key(storeId, 'dashboard', range));
	}
	putDashboard(storeId: string, range: string, stats: DashboardStats): Promise<Cached<DashboardStats>> {
		return this.write(this.key(storeId, 'dashboard', range), stats);
	}

	getProducts(storeId: string, filterKey: string): Promise<Cached<Paginated<ProductSummary>> | null> {
		return this.read(this.key(storeId, 'products', filterKey));
	}
	putProducts(storeId: string, filterKey: string, page: Paginated<ProductSummary>): Promise<Cached<Paginated<ProductSummary>>> {
		return this.write(this.key(storeId, 'products', filterKey), page);
	}

	getProduct(storeId: string, productId: number): Promise<Cached<ProductDetail> | null> {
		return this.read(this.key(storeId, 'product', String(productId)));
	}
	putProduct(storeId: string, productId: number, detail: ProductDetail): Promise<Cached<ProductDetail>> {
		return this.write(this.key(storeId, 'product', String(productId)), detail);
	}

	getProductMeta(storeId: string): Promise<Cached<ProductMeta> | null> {
		return this.read(this.key(storeId, 'productmeta'));
	}
	putProductMeta(storeId: string, meta: ProductMeta): Promise<Cached<ProductMeta>> {
		return this.write(this.key(storeId, 'productmeta'), meta);
	}

	// Drop every cached row for a store (called when the store is removed).
	async clearStore(storeId: string): Promise<void> {
		const prefix = `v${CACHE_VERSION}.${storeId}.`;
		for (const k of await this.kv.keys()) {
			if (k.startsWith(prefix)) await this.kv.remove(k);
		}
	}
}
