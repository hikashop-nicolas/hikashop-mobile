// Data shapes returned by the HikaShop connector API (Phase 0), plus the local Store record.

export type Scope = 'read' | 'write' | 'pos';

export interface PairResult {
	token: string;
	scopes: Scope[];
	device_id: number;
}

export interface SiteInfo {
	app: string;
	api_version: number;
	hikashop_version: string | null;
	cms: { name: string; version: string | null };
	edition: string;
	currency: { default: number };
	price_with_tax: boolean;
	operator: { id: number; name: string; role: string };
	scopes: Scope[];
	capabilities: { pos: boolean; push: boolean; multivendor: boolean };
}

export interface OrderSummary {
	id: number;
	number: string;
	status: string;
	created: number;
	total: number;
	currency_id: number;
	customer: { name: string | null; email: string | null };
}

export interface OrderItem {
	name: string;
	code: string;
	quantity: number;
	price: number;
	tax: number;
}

export interface OrderAddress {
	name: string;
	company: string;
	street: string;
	city: string;
	post_code: string;
}

export interface OrderDetail {
	id: number;
	number: string;
	status: string;
	created: number;
	modified: number;
	currency_id: number;
	totals: { total: number; discount: number; shipping: number; payment: number; tax: number };
	customer: { name: string; email: string };
	items: OrderItem[];
	billing_address: OrderAddress | null;
	shipping_address: OrderAddress | null;
	history: { status: string; created: number }[];
}

export interface DashboardStats {
	range: string;
	totals: { revenue: number; orders: number; average_order: number; customers: number };
	revenue_series: { date: string; revenue: number }[];
	top_products: { name: string; quantity: number }[];
}

export interface Paginated<T> {
	items: T[];
	total: number;
	start: number;
	limit: number;
}

// A store the app has been paired with (its token is kept separately, in secure storage).
export interface Store {
	id: string;
	name: string;
	baseUrl: string;
	role: string;
	capabilities?: SiteInfo['capabilities'];
	createdAt: number;
}
