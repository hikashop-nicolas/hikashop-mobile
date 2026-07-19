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

export interface OrderStatusResult {
	id: number;
	status: string;
	changed: boolean;
	notified: boolean;
}

export interface ProductSummary {
	id: number;
	name: string;
	code: string;
	quantity: number; // -1 means unlimited
	published: boolean;
	has_variants: boolean;
	image: string; // thumbnail URL ('' if none)
	price: number | null;
	currency_id: number;
}

export interface ProductPrice {
	id: number;
	value: number;
	currency_id: number;
	min_quantity: number;
	access: string;
	start_date: number;
	end_date: number;
}

export interface ProductImage {
	id: number;
	name: string;
	path: string;
	url: string;
	ordering: number;
	description: string;
}

export interface ProductFile extends ProductImage {
	access: string;
	free_download: boolean;
}

export interface CharacteristicValue {
	id: number;
	value: string;
}

export interface ProductCharacteristic {
	id: number;
	name: string;
	values: CharacteristicValue[];
}

export interface VariantValue {
	option_id: number;
	option_name: string;
	value_id: number;
	value: string;
}

export interface ProductVariant {
	id: number;
	code: string;
	quantity: number;
	published: boolean;
	price: number | null;
	values: VariantValue[];
}

export interface ProductDetail {
	id: number;
	name: string;
	code: string;
	description: string;
	description_type: string;
	published: boolean;
	quantity: number;
	msrp: number;
	gtin: string;
	condition: string;
	weight: number;
	weight_unit: string;
	width: number;
	height: number;
	length: number;
	dimension_unit: string;
	min_per_order: number;
	max_per_order: number;
	sale_start: number;
	sale_end: number;
	page_title: string;
	meta_description: string;
	keywords: string;
	canonical: string;
	url: string;
	type: string;
	parent_id: number;
	manufacturer_id: number;
	manufacturer_name: string;
	tax_id: number;
	tax_name: string;
	prices: ProductPrice[];
	images: ProductImage[];
	files: ProductFile[];
	categories: { id: number; name: string }[];
	characteristics: ProductCharacteristic[];
	variants: ProductVariant[];
	custom_fields: Record<string, string | null>;
}

// A shop-defined custom field on the product (from GET /products/meta).
export interface ProductField {
	namekey: string;
	type: string;
	label: string;
	default: string;
	required: boolean;
	options: { value: string; label: string }[];
}

// A category row for the management list (includes unpublished ones).
export interface CategoryListItem {
	id: number;
	name: string;
	parent_id: number;
	published: boolean;
}

// Full category for the editor.
export interface CategoryDetail {
	id: number;
	name: string;
	parent_id: number;
	type: string;
	description: string;
	meta_description: string;
	published: boolean;
	image: string;
	custom_fields: Record<string, string | null>;
}

// Payload for creating a category or a manufacturer (both are HikaShop categories).
export interface CategoryInput {
	name: string;
	parent_id?: number;
	description?: string;
	meta_description?: string;
	published?: boolean;
	image?: string;
	image_name?: string;
	custom_fields?: Record<string, string>;
}

// Scalar field types the connector accepts on write; others are read-only.
export const WRITABLE_FIELD_TYPES = [
	'text', 'textarea', 'number', 'integer', 'date', 'email', 'url', 'tel', 'color',
	'singledropdown', 'radio', 'multidropdown', 'checkbox',
];

// A shop currency plus the parts needed to render a price faithfully to its settings.
export interface Currency {
	id: number;
	code: string;
	symbol: string;
	name: string;
	decimals: number;
	decimal_sep: string;
	thousands_sep: string;
	symbol_before: boolean;
	space: boolean;
}

export interface ProductMeta {
	currencies: Currency[];
	tax_categories: { id: number; name: string; parent_id: number }[];
	manufacturers: { id: number; name: string; parent_id: number }[];
	categories: { id: number; name: string; parent_id: number }[];
	access_levels: { id: number; name: string }[];
	characteristics: ProductCharacteristic[];
	weight_units: string[];
	dimension_units: string[];
	product_fields: ProductField[];
	category_fields: ProductField[];
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
