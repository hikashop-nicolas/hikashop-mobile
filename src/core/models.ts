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
	value: number; // always tax-exclusive
	currency_id: number;
	min_quantity: number;
	access: string;
	users: number[]; // restrict to specific users (preserved round-trip)
	zone_ids: number[]; // restrict to zones (preserved round-trip)
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

// A page of the shop upload folder from GET /media/browse.
export interface MediaListing {
	folder: string;
	parent: string;
	has_parent: boolean;
	folders: { name: string; path: string }[];
	images: { name: string; path: string; url: string }[];
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
	alias: string;
	access: string;
	contact: boolean;
	warehouse_id: number;
	tax_rate: number; // the product's tax rate (e.g. 0.06) for excl/incl price entry
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
	bundle: RelatedProduct[];
	options: RelatedProduct[];
	related: RelatedProduct[];
	tags: number[];
	custom_fields: Record<string, string | null>;
	custom_field_files: Record<string, FieldFile[]>;
	value_ids?: number[]; // characteristic value ids, present when this is a variant
}

// A product linked to another as a bundle item, option or related product.
export interface RelatedProduct {
	id: number;
	name: string;
	code: string;
	quantity: number; // meaningful for bundle only
}

// A shop-defined custom field on the product (from GET /products/meta).
export interface ProductField {
	namekey: string;
	type: string; // normalized: datepicker, ajaximage, ajaxfile, wysiwyg, text...
	raw_type: string;
	label: string;
	default: string;
	required: boolean;
	options: { value: string; label: string }[];
	multiple: boolean;
	upload_dir: string;
	allowed_extensions: string;
	date_format: string;
	datepicker?: DatepickerConfig;
}

// Advanced date-picker (plg.datepickerfield) constraints, mirrored from the field's
// datepicker_options so the app can honour them with a native date input.
export interface DatepickerConfig {
	allow: '' | 'future' | 'past';
	waiting: number;
	days_from_now: number;
	forbidden_days: number[]; // 0 = Sunday .. 6 = Saturday
	range: boolean;
	range_exclude_end: boolean;
	range_min_nights: number;
	range_max_nights: number;
	exclude_days: number[]; // m*100+d, any year
	exclude_dates: number[]; // y*10000+m*100+d
	exclude_ranges: [number, number, number][]; // [start, end, count(2=md,3=fd)]
	exclude_patterns: [number, number, number][]; // [month, day, year], 0 = any
}

// A resolved file for an ajax image/file custom field (from custom_field_files).
export interface FieldFile {
	path: string;
	name: string;
	url: string;
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
	custom_field_files: Record<string, FieldFile[]>;
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
	'text', 'textarea', 'number', 'integer', 'date', 'datepicker', 'email', 'url', 'tel', 'color',
	'singledropdown', 'radio', 'multidropdown', 'checkbox', 'wysiwyg', 'ajaximage', 'ajaxfile',
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
	bundle_supported: boolean;
	warehouses: { id: number; name: string }[];
	tags: { id: number; name: string; parent_id: number }[];
}

// Whitelisted shop config flags (from GET /settings) the app uses to gate UI.
export interface Settings {
	product_contact: boolean;
	product_waitlist: boolean;
	price_with_tax: boolean;
	show_original_price: boolean;
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
