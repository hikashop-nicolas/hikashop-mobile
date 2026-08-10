// Cache-then-network read models, namespaced per store_id. Backed by an injectable
// KeyValueStore so the PWA uses browser storage today and native builds can swap in the
// SQLite repository later without touching callers. A version prefix invalidates stale
// shapes on a schema bump until a full migration runner lands (Phase 3 queue/ledger).

import type { KeyValueStore } from './storage';
import type { OrderSummary, OrderDetail, DashboardStats, Paginated, ProductSummary, ProductDetail, ProductMeta, CategoryListItem, Settings, OrderStatusDef, CustomerSummary, CustomerDetail, Discount, ShopLanguages } from './models';

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

	// A cache write is best-effort and must never break the caller: several screens await it
	// before navigating, so a full-storage error here would strand the user on a saved form.
	// When the backing store rejects (typically a quota error), evict the oldest entries and
	// retry once; if it still fails, carry on with the value in memory.
	private async write<T>(k: string, data: T): Promise<Cached<T>> {
		const entry: Cached<T> = { data, fetchedAt: this.now() };
		const payload = JSON.stringify(entry);
		try {
			await this.kv.set(k, payload);
		} catch {
			try {
				await this.evictOldest(0.5);
				await this.kv.set(k, payload);
			} catch {
				// Out of room and nothing left to reclaim: the read model still works, just uncached.
			}
		}
		return entry;
	}

	// Cache slots that can be refetched cheaply on demand. The translation dictionary and the
	// change tokens are deliberately excluded: they are large or expensive to re-download and
	// are already invalidated by their version token.
	private static EVICTABLE = ['orders', 'order', 'products', 'product', 'productmeta',
		'customers', 'customer', 'discounts', 'discount', 'dashboard', 'categories', 'settings'];

	private static isEvictable(key: string): boolean {
		// Keys look like v1.<storeId>.<kind>[.<rest>]; the kind is the third segment.
		const kind = key.split('.')[2];
		return kind !== undefined && CacheRepository.EVICTABLE.includes(kind);
	}

	// Drop the oldest evictable entries (a fraction of them, 0..1), oldest first. Returns how
	// many were removed. Used on a failed write and callable at startup to cap growth.
	async evictOldest(fraction: number): Promise<number> {
		const keys = (await this.kv.keys()).filter(CacheRepository.isEvictable);
		if (keys.length === 0) return 0;

		const dated: { key: string; at: number }[] = [];
		for (const key of keys) {
			const raw = await this.kv.get(key);
			let at = 0;
			try {
				const parsed = raw ? (JSON.parse(raw) as Cached<unknown>) : null;
				at = parsed && typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0;
			} catch {
				at = 0; // unparseable: treat as oldest so it goes first
			}
			dated.push({ key, at });
		}
		dated.sort((a, b) => a.at - b.at);

		const target = Math.max(1, Math.ceil(dated.length * Math.min(1, Math.max(0, fraction))));
		for (const { key } of dated.slice(0, target)) await this.kv.remove(key);
		return target;
	}

	// Keep the cache bounded: if more than `max` evictable entries exist, drop the oldest ones.
	// Called once at startup, so a long-lived install does not grow without limit.
	async pruneTo(max: number): Promise<number> {
		const count = (await this.kv.keys()).filter(CacheRepository.isEvictable).length;
		if (count <= max) return 0;
		return this.evictOldest((count - max) / count);
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

	// A resource's last-seen change token (e.g. name = 'i18n.fr-FR' or 'statuses'), so a cached
	// payload can be kept until its token changes.
	async getVersionTag(storeId: string, name: string): Promise<string | null> {
		const c = await this.read<string>(this.key(storeId, 'ver', name));
		return c ? c.data : null;
	}
	putVersionTag(storeId: string, name: string, tag: string): Promise<Cached<string>> {
		return this.write(this.key(storeId, 'ver', name), tag);
	}

	getStatuses(storeId: string): Promise<Cached<OrderStatusDef[]> | null> {
		return this.read(this.key(storeId, 'statuses'));
	}
	putStatuses(storeId: string, statuses: OrderStatusDef[]): Promise<Cached<OrderStatusDef[]>> {
		return this.write(this.key(storeId, 'statuses'), statuses);
	}

	getTranslations(storeId: string, locale: string): Promise<Cached<{ locale: string; strings: Record<string, string> }> | null> {
		return this.read(this.key(storeId, 'i18n', locale));
	}
	putTranslations(storeId: string, locale: string, dict: { locale: string; strings: Record<string, string> }): Promise<Cached<{ locale: string; strings: Record<string, string> }>> {
		return this.write(this.key(storeId, 'i18n', locale), dict);
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

	getDiscounts(storeId: string, filterKey: string): Promise<Cached<Paginated<Discount>> | null> {
		return this.read(this.key(storeId, 'discounts', filterKey));
	}
	putDiscounts(storeId: string, filterKey: string, page: Paginated<Discount>): Promise<Cached<Paginated<Discount>>> {
		return this.write(this.key(storeId, 'discounts', filterKey), page);
	}

	getDiscount(storeId: string, id: number): Promise<Cached<Discount> | null> {
		return this.read(this.key(storeId, 'discount', String(id)));
	}
	putDiscount(storeId: string, id: number, discount: Discount): Promise<Cached<Discount>> {
		return this.write(this.key(storeId, 'discount', String(id)), discount);
	}

	getCustomers(storeId: string, filterKey: string): Promise<Cached<Paginated<CustomerSummary>> | null> {
		return this.read(this.key(storeId, 'customers', filterKey));
	}
	putCustomers(storeId: string, filterKey: string, page: Paginated<CustomerSummary>): Promise<Cached<Paginated<CustomerSummary>>> {
		return this.write(this.key(storeId, 'customers', filterKey), page);
	}

	getCustomer(storeId: string, customerId: number): Promise<Cached<CustomerDetail> | null> {
		return this.read(this.key(storeId, 'customer', String(customerId)));
	}
	putCustomer(storeId: string, customerId: number, detail: CustomerDetail): Promise<Cached<CustomerDetail>> {
		return this.write(this.key(storeId, 'customer', String(customerId)), detail);
	}

	getProductMeta(storeId: string): Promise<Cached<ProductMeta> | null> {
		return this.read(this.key(storeId, 'productmeta'));
	}
	putProductMeta(storeId: string, meta: ProductMeta): Promise<Cached<ProductMeta>> {
		return this.write(this.key(storeId, 'productmeta'), meta);
	}

	getSettings(storeId: string): Promise<Cached<Settings> | null> {
		return this.read(this.key(storeId, 'settings'));
	}
	putSettings(storeId: string, settings: Settings): Promise<Cached<Settings>> {
		return this.write(this.key(storeId, 'settings'), settings);
	}

	// The shop's languages, cached against the change token in /version: they move when a
	// merchant publishes one, which is rarely, and the answer gates a whole screen.
	getShopLanguages(storeId: string): Promise<Cached<ShopLanguages> | null> {
		return this.read(this.key(storeId, 'languages'));
	}
	putShopLanguages(storeId: string, langs: ShopLanguages): Promise<Cached<ShopLanguages>> {
		return this.write(this.key(storeId, 'languages'), langs);
	}

	getCategories(storeId: string, kind: string): Promise<Cached<CategoryListItem[]> | null> {
		return this.read(this.key(storeId, 'categories', kind));
	}
	putCategories(storeId: string, kind: string, list: CategoryListItem[]): Promise<Cached<CategoryListItem[]>> {
		return this.write(this.key(storeId, 'categories', kind), list);
	}

	// Drop every cached row for a store (called when the store is removed).
	async clearStore(storeId: string): Promise<void> {
		const prefix = `v${CACHE_VERSION}.${storeId}.`;
		for (const k of await this.kv.keys()) {
			if (k.startsWith(prefix)) await this.kv.remove(k);
		}
	}
}
