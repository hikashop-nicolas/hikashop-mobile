// Typed client for the HikaShop connector API. Transport is injectable (default: global fetch)
// so native builds can swap in a CORS-free HTTP bridge and tests can mock responses.

import type {
	PairResult, SiteInfo, OrderSummary, OrderDetail, DashboardStats, Paginated, OrderStatusResult,
	ProductSummary, ProductDetail, ProductMeta, ProductPrice, ProductImage, ProductFile, ProductCharacteristic, ProductVariant,
	CategoryInput, CategoryListItem, CategoryDetail, MediaListing,
} from './models';

export class ApiError extends Error {
	code: string;
	status: number;
	constructor(code: string, message: string, status: number) {
		super(message);
		this.name = 'ApiError';
		this.code = code;
		this.status = status;
	}
}

export interface OrderFilters {
	start?: number;
	limit?: number;
	status?: string;
	search?: string;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// The connector always answers on the index.php path, which works regardless of the
// merchant's SEF/rewrite settings (and before any SEF redirect).
export const API_PATH = '/index.php/hikashop-api/v1';

// Native fetch must run with the global as receiver; a stored reference invoked as
// this.fetchFn(...) would pass the wrong `this` and throw "Illegal invocation". Wrap it.
const defaultFetch: FetchLike = (input, init) => fetch(input, init);

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Query = Record<string, string | number | undefined>;

export class ApiClient {
	private baseUrl: string;
	private token: string | null;
	private fetchFn: FetchLike;

	constructor(baseUrl: string, token: string | null = null, fetchFn: FetchLike = defaultFetch) {
		this.baseUrl = baseUrl;
		this.token = token;
		this.fetchFn = fetchFn;
	}

	private url(path: string, query?: Query): string {
		const base = this.baseUrl.replace(/\/+$/, '') + API_PATH + '/' + path.replace(/^\/+/, '');
		if (!query) return base;
		const q = Object.entries(query)
			.filter(([, v]) => v !== undefined && v !== '')
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
			.join('&');
		return q ? `${base}?${q}` : base;
	}

	private async request<T>(
		method: string,
		path: string,
		opts: { query?: Query; body?: unknown; auth?: boolean } = {},
	): Promise<{ data: T; meta: Record<string, unknown> | null }> {
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (opts.auth !== false && this.token) headers['Authorization'] = `Bearer ${this.token}`;
		if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

		const url = this.url(path, opts.query);
		const init: RequestInit = { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined };

		// Retry transient upstream failures (a busy server returns 502/503/504, and the request
		// usually did not run) a couple of times with a short backoff before giving up.
		const TRANSIENT = new Set([502, 503, 504]);
		let res: Response | null = null;
		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				res = await this.fetchFn(url, init);
			} catch {
				if (attempt < 3) { await delay(attempt * 300); continue; }
				throw new ApiError('network', 'Could not reach the store. Check the connection and the address.', 0);
			}
			if (TRANSIENT.has(res.status) && attempt < 3) { await delay(attempt * 300); continue; }
			break;
		}
		if (res === null) throw new ApiError('network', 'Could not reach the store. Check the connection and the address.', 0);

		let json: { data?: T; meta?: Record<string, unknown> | null; error?: { code?: string; message?: string } };
		try {
			json = await res.json();
		} catch {
			throw new ApiError('bad_response', 'The store returned an unexpected response.', res.status);
		}
		if (json && json.error) {
			throw new ApiError(json.error.code || 'error', json.error.message || 'The request failed.', res.status);
		}
		if (!res.ok) {
			throw new ApiError('http_error', `Request failed (HTTP ${res.status}).`, res.status);
		}
		return { data: json.data as T, meta: json.meta ?? null };
	}

	// Public pairing exchange: no token, returns the device token once.
	static async pair(
		baseUrl: string,
		code: string,
		deviceName: string,
		platform: string,
		fetchFn: FetchLike = defaultFetch,
	): Promise<PairResult> {
		const client = new ApiClient(baseUrl, null, fetchFn);
		const { data } = await client.request<PairResult>('POST', 'pair', {
			auth: false,
			body: { code, device_name: deviceName, platform },
		});
		return data;
	}

	async getSite(): Promise<SiteInfo> {
		return (await this.request<SiteInfo>('GET', 'site')).data;
	}

	async getOrders(filters: OrderFilters = {}): Promise<Paginated<OrderSummary>> {
		const query: Query = { start: filters.start, limit: filters.limit, status: filters.status, search: filters.search };
		const { data, meta } = await this.request<OrderSummary[]>('GET', 'orders', { query });
		return {
			items: data || [],
			total: Number(meta?.total ?? 0),
			start: Number(meta?.start ?? 0),
			limit: Number(meta?.limit ?? 0),
		};
	}

	async getOrder(id: number): Promise<OrderDetail> {
		return (await this.request<OrderDetail>('GET', `orders/${id}`)).data;
	}

	// Change an order's status (write scope). notify asks the store to email the customer.
	async setOrderStatus(id: number, status: string, opts: { notify?: boolean; reason?: string } = {}): Promise<OrderStatusResult> {
		const { data } = await this.request<OrderStatusResult>('POST', `orders/${id}/status`, {
			body: { status, notify: !!opts.notify, reason: opts.reason ?? '' },
		});
		return data;
	}

	async getDashboard(range = 'week'): Promise<DashboardStats> {
		return (await this.request<DashboardStats>('GET', 'stats/dashboard', { query: { range } })).data;
	}

	async getProducts(filters: { start?: number; limit?: number; search?: string; category_id?: number } = {}): Promise<Paginated<ProductSummary>> {
		const query: Query = { start: filters.start, limit: filters.limit, search: filters.search, category_id: filters.category_id };
		const { data, meta } = await this.request<ProductSummary[]>('GET', 'products', { query });
		return {
			items: data || [],
			total: Number(meta?.total ?? 0),
			start: Number(meta?.start ?? 0),
			limit: Number(meta?.limit ?? 0),
		};
	}

	async getProduct(id: number): Promise<ProductDetail> {
		return (await this.request<ProductDetail>('GET', `products/${id}`)).data;
	}

	// Reference data for the product editor (currencies, taxes, categories, access levels...).
	async getProductMeta(): Promise<ProductMeta> {
		return (await this.request<ProductMeta>('GET', 'products/meta')).data;
	}

	// Update a product's core fields (write scope). Returns the full refreshed product.
	async updateProduct(id: number, fields: Record<string, unknown>): Promise<ProductDetail> {
		return (await this.request<ProductDetail>('PUT', `products/${id}`, { body: fields })).data;
	}

	async createProduct(fields: Record<string, unknown>): Promise<ProductDetail> {
		return (await this.request<ProductDetail>('POST', 'products', { body: fields })).data;
	}

	async deleteProduct(id: number): Promise<{ id: number; deleted: boolean }> {
		return (await this.request<{ id: number; deleted: boolean }>('DELETE', `products/${id}`)).data;
	}

	async setProductPrices(id: number, prices: unknown[]): Promise<ProductPrice[]> {
		return (await this.request<ProductPrice[]>('PUT', `products/${id}/prices`, { body: { prices } })).data;
	}

	async setProductCategories(id: number, categories: number[]): Promise<{ id: number; name: string }[]> {
		return (await this.request<{ id: number; name: string }[]>('PUT', `products/${id}/categories`, { body: { categories } })).data;
	}

	async uploadProductMedia(id: number, kind: 'images' | 'files', file: { name: string; data: string; description?: string; access?: string }): Promise<ProductFile> {
		return (await this.request<ProductFile>('POST', `products/${id}/${kind}`, { body: file })).data;
	}

	// Attach an already-uploaded file (from the media browser) by its path.
	async attachProductMedia(id: number, kind: 'images' | 'files', file: { path: string; name?: string; description?: string; access?: string }): Promise<ProductFile> {
		return (await this.request<ProductFile>('POST', `products/${id}/${kind}`, { body: file })).data;
	}

	// Edit a file's options (name, description, access, free_download).
	async updateProductFile(id: number, fileId: number, opts: { name?: string; description?: string; access?: string; free_download?: boolean }): Promise<ProductFile> {
		return (await this.request<ProductFile>('PUT', `products/${id}/files/${fileId}`, { body: opts })).data;
	}

	async deleteProductFile(id: number, fileId: number): Promise<{ id: number; deleted: boolean }> {
		return (await this.request<{ id: number; deleted: boolean }>('DELETE', `products/${id}/files/${fileId}`)).data;
	}

	// Browse the shop's upload folder (folders + images) for the media picker.
	async browseMedia(folder = ''): Promise<MediaListing> {
		return (await this.request<MediaListing>('GET', 'media/browse', { query: { folder } })).data;
	}

	// Reorder a product's images and/or files (write scope); ids in the desired order.
	async setProductMediaOrder(id: number, order: { images?: number[]; files?: number[] }): Promise<{ images: ProductImage[]; files: ProductFile[] }> {
		return (await this.request<{ images: ProductImage[]; files: ProductFile[] }>('PUT', `products/${id}/media/order`, { body: order })).data;
	}

	async createCharacteristic(body: { parent_id?: number; value: string }): Promise<{ id: number; value: string; parent_id: number }> {
		return (await this.request<{ id: number; value: string; parent_id: number }>('POST', 'products/characteristics', { body })).data;
	}

	// Create a product category (write scope). No parent_id creates a top-level one.
	async createCategory(body: CategoryInput): Promise<{ id: number; name: string; parent_id: number; published: boolean }> {
		return (await this.request<{ id: number; name: string; parent_id: number; published: boolean }>('POST', 'products/categories', { body })).data;
	}

	// Create a manufacturer / brand (write scope).
	async createManufacturer(body: CategoryInput): Promise<{ id: number; name: string; parent_id: number; published: boolean }> {
		return (await this.request<{ id: number; name: string; parent_id: number; published: boolean }>('POST', 'products/manufacturers', { body })).data;
	}

	// Category management (read/write scope).
	async listCategories(type: 'product' | 'manufacturer' = 'product'): Promise<CategoryListItem[]> {
		return (await this.request<CategoryListItem[]>('GET', 'categories', { query: { type } })).data;
	}

	async getCategory(id: number): Promise<CategoryDetail> {
		return (await this.request<CategoryDetail>('GET', `categories/${id}`)).data;
	}

	async updateCategory(id: number, body: CategoryInput): Promise<CategoryDetail> {
		return (await this.request<CategoryDetail>('PUT', `categories/${id}`, { body })).data;
	}

	async deleteCategory(id: number): Promise<{ id: number; deleted: boolean }> {
		return (await this.request<{ id: number; deleted: boolean }>('DELETE', `categories/${id}`)).data;
	}

	async setProductVariants(id: number, variants: unknown[]): Promise<{ characteristics: ProductCharacteristic[]; variants: ProductVariant[] }> {
		return (await this.request<{ characteristics: ProductCharacteristic[]; variants: ProductVariant[] }>('PUT', `products/${id}/variants`, { body: { variants } })).data;
	}

	// Edit a single variant (write scope). Returns the refreshed variant as a product detail.
	async updateVariant(productId: number, variantId: number, body: Record<string, unknown>): Promise<ProductDetail> {
		return (await this.request<ProductDetail>('PUT', `products/${productId}/variants/${variantId}`, { body })).data;
	}

	// Set a product's tracked quantity (write scope). A negative value means "unlimited".
	async setProductStock(id: number, quantity: number): Promise<{ id: number; quantity: number }> {
		const { data } = await this.request<{ id: number; quantity: number }>('POST', `products/${id}/stock`, {
			body: { quantity },
		});
		return data;
	}
}
