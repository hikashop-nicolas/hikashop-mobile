// Typed client for the HikaShop connector API. Transport is injectable (default: global fetch)
// so native builds can swap in a CORS-free HTTP bridge and tests can mock responses.

import type {
	PairResult, SiteInfo, OrderSummary, OrderDetail, DashboardStats, Paginated, OrderStatusResult,
	ProductSummary, ProductDetail, ProductMeta,
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

		let res: Response;
		try {
			res = await this.fetchFn(this.url(path, opts.query), {
				method,
				headers,
				body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
			});
		} catch {
			throw new ApiError('network', 'Could not reach the store. Check the connection and the address.', 0);
		}

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

	async getProducts(filters: { start?: number; limit?: number; search?: string } = {}): Promise<Paginated<ProductSummary>> {
		const query: Query = { start: filters.start, limit: filters.limit, search: filters.search };
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

	// Set a product's tracked quantity (write scope). A negative value means "unlimited".
	async setProductStock(id: number, quantity: number): Promise<{ id: number; quantity: number }> {
		const { data } = await this.request<{ id: number; quantity: number }>('POST', `products/${id}/stock`, {
			body: { quantity },
		});
		return data;
	}
}
