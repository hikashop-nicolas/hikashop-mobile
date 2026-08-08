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
	id: number; // order_product_id
	name: string;
	code: string;
	quantity: number;
	price: number;
	tax: number;
	editable: boolean; // false for legacy "additional" fee lines
}

// How an address reads is a shop setting (Configuration > Checkout) and the right order differs
// by country, so the connector renders it with HikaShop's own format and the app shows that. The
// individual columns stay for editing and for the rare shop that empties the format.
export interface FormattedAddress {
	text: string;      // full block, newline separated
	one_line: string;  // condensed, for list rows
}

export interface OrderAddress {
	name: string;
	company: string;
	street: string;
	city: string;
	post_code: string;
	formatted?: FormattedAddress;
}

export interface OrderHistoryEntry {
	status: string;
	created: number;
	type: string;
	reason: string;
	notified: boolean;
}

// A tax rate the operator can apply to an order fee.
export interface TaxRate {
	namekey: string;
	rate: number; // fraction, e.g. 0.2 for 20%
}

// An editable order-level fee. amount is ex-tax; tax is the computed total; tax_namekeys
// are the applied rates. method is present for shipping/payment; code for discount.
export interface OrderFee {
	amount: number;
	tax: number;
	tax_namekeys: string[];
	method?: string;
	code?: string;
}

export interface OrderFees {
	discount: OrderFee;
	shipping: OrderFee;
	payment: OrderFee;
}

// A shop order status (from GET /statuses), in the shop's configured order.
export interface OrderStatusDef {
	namekey: string; // what the status endpoint expects
	name: string; // translated name (site locale)
	label_key: string; // ORDER_STATUS_* key, for dictionary resolution
	color: string; // merchant-set hex, or ''
}

// A shop coupon (from GET /coupons), for the operator to browse and apply to an order.
export interface Coupon {
	id: number;
	code: string;
	flat_amount: number;
	percent_amount: number;
	currency_id: number;
	start: number;
	end: number;
	quota: number;
	used_times: number;
	minimum_order: number;
}

// A product priced in an order's context, ready to be added as a line (editable first).
export interface OrderProductPrecompute {
	product_id: number;
	name: string;
	code: string;
	quantity: number;
	price: number; // ex-tax
	tax: number;
	tax_namekeys: string[];
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
	payment_method: string;
	shipping_method: string;
	invoice_number: string;
	invoice_created: number;
	items: OrderItem[];
	billing_address: OrderAddress | null;
	shipping_address: OrderAddress | null;
	history: OrderHistoryEntry[];
	// Shop-defined custom order fields: definitions (same shape as ProductField),
	// their current values, and resolved files for ajax image/file fields.
	fields: ProductField[];
	custom_fields: Record<string, string | null>;
	custom_field_files: Record<string, FieldFile[]>;
	fees: OrderFees;
	tax_rates: TaxRate[];
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
	access: Access;
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
	access: Access;
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
	access: Access;
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
	// The fields that apply to THIS product; a field can be restricted to certain categories
	// or products, so the set differs per row and the global meta list is only a fallback.
	fields?: ProductField[];
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
	options: { value: string; label: string; label_key?: string }[];
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
	access: Access;
	image: string;
	custom_fields: Record<string, string | null>;
	custom_field_files: Record<string, FieldFile[]>;
	// The fields that apply to THIS category; a field can be restricted to part of the tree.
	fields?: ProductField[];
}

// Payload for creating a category or a manufacturer (both are HikaShop categories).
export interface CategoryInput {
	name: string;
	parent_id?: number;
	description?: string;
	meta_description?: string;
	published?: boolean;
	access?: Access;
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
	characteristics: ProductCharacteristic[];
	weight_units: string[];
	dimension_units: string[];
	product_fields: ProductField[];
	category_fields: ProductField[];
	bundle_supported: boolean;
	warehouses: { id: number; name: string }[];
	tags: { id: number; name: string; parent_id: number }[];
}

// A zone (country / state / tax) for restricting a price to regions.
export interface ZoneItem {
	id: number;
	namekey: string; // what addresses store (e.g. country_France_73)
	name: string;
	type: string; // country | state | tax
}

// A billing/shipping address form for an order: the shop's published address fields,
// current values, and the resolved country/state display names (stored as namekeys).
export interface OrderAddressForm {
	type: 'billing' | 'shipping';
	address_id: number;
	fields: ProductField[];
	values: Record<string, string>;
	country_name: string;
	state_name: string;
}

// HikaShop's two promotion types: a coupon (the customer enters a code) or an automatic discount.
export type DiscountType = 'coupon' | 'discount';

// Who a row is visible to: everyone, nobody, or specific customer groups. HikaShop stores this
// identically for products, categories, prices, files and discounts.
export interface Access {
	mode: 'all' | 'none' | 'groups';
	groups: number[];
}

// A promotion: a percentage or flat-amount reduction with optional limits.
export interface Discount {
	id: number;
	type: DiscountType;
	code: string; // empty for an automatic discount
	kind: 'percent' | 'flat';
	value: number;
	currency_id: number;
	published: boolean;
	start: number; // unix, 0 = none
	end: number;   // unix, 0 = none
	minimum_order: number;
	maximum_order: number;
	quota: number; // total uses, 0 = unlimited
	quota_per_user: number; // 0 = unlimited
	used_times: number;
	tax_included: boolean; // flat amount includes tax

	tax_id: number;
	shipping_percent: number;

	minimum_products: number;
	maximum_products: number;
	product_ids: number[];
	exclude_product_ids: number[];
	category_ids: number[];
	category_childs: boolean;
	exclude_category_ids: number[];
	exclude_category_childs: boolean;
	zone_ids: number[];
	user_ids: number[];
	access: Access;
	exclude_access: Access;

	auto_load: boolean;      // the coupon applies without being entered
	product_only: boolean;   // applies to product lines only, not shipping or fees
	discounted_products: number; // 0 standard, 1 ignore discounted, 2 override them
}

// The editable subset sent when creating/updating a promotion.
export interface DiscountInput {
	type: DiscountType;
	code: string;
	kind: 'percent' | 'flat';
	value: number;
	currency_id?: number;
	published?: boolean;
	start?: number;
	end?: number;
	minimum_order?: number;
	maximum_order?: number;
	quota?: number;
	quota_per_user?: number;
	tax_included?: boolean;

	tax_id?: number;
	shipping_percent?: number;
	minimum_products?: number;
	maximum_products?: number;
	product_ids?: number[];
	exclude_product_ids?: number[];
	category_ids?: number[];
	category_childs?: boolean;
	exclude_category_ids?: number[];
	exclude_category_childs?: boolean;
	zone_ids?: number[];
	user_ids?: number[];
	access?: Access;
	exclude_access?: Access;
	auto_load?: boolean;
	product_only?: boolean;
	discounted_products?: number;
}

// A scanned barcode resolved to a product. A variant resolves to its parent, the screen that
// can act on it, with variant_id kept so the app can point at the right row.
export interface BarcodeMatch {
	id: number;
	variant_id: number;
	name: string;
	code: string;
	gtin: string;
	quantity: number;
}

// A HikaShop user for restricting a price to specific customers.
export interface UserItem {
	id: number;
	name: string;
	email: string;
}

// A customer row in the customers list.
export interface CustomerSummary {
	id: number;
	name: string;
	email: string;
	type: string; // registered | guest
	created: number;
	order_count: number;
}

// A single customer address, as shown on the customer detail screen.
export interface CustomerAddress {
	id: number;
	types: string[]; // billing and/or shipping
	name: string;
	company: string;
	street: string;
	city: string;
	post_code: string;
	telephone: string;
	default: boolean;
	formatted?: FormattedAddress;
}

// A Joomla user group the customer belongs to.
export interface UserGroup {
	id: number;
	title: string;
}

// A customer's order, as shown on the customer detail screen.
export interface CustomerOrder {
	id: number;
	number: string;
	status: string;
	created: number;
	total: number;
	currency_id: number;
}

// A user group the operator may assign (an admin group is only assignable by a super admin).
export interface AssignableGroup extends UserGroup {
	assignable: boolean;
}

// Full customer profile with their addresses, orders, groups and custom fields.
export interface CustomerDetail {
	id: number;
	cms_id: number; // 0 for guests (no Joomla account)
	name: string;
	email: string;
	username: string;
	type: string; // registered | guest
	blocked: boolean;
	can_edit_account: boolean; // false when the operator lacks the ACL to edit this account
	groups_editable: boolean; // false where the platform can't persist group changes (e.g. WordPress)
	groups: UserGroup[];
	available_groups: AssignableGroup[];
	created: number;
	addresses: CustomerAddress[];
	orders: CustomerOrder[];
	fields: ProductField[]; // custom user field definitions
	custom_fields: Record<string, string | null>;
	custom_field_files: Record<string, FieldFile[]>;
}

// A customer address-book entry's edit form (shape shared with the reusable address editor).
export interface CustomerAddressForm {
	address_id: number;
	types: string[];
	default: boolean;
	fields: ProductField[];
	values: Record<string, string>;
	country_name: string;
	state_name: string;
}

// Whitelisted shop config flags (from GET /settings) the app uses to gate UI.
export interface Settings {
	product_contact: boolean;
	product_waitlist: boolean;
	price_with_tax: boolean;
	// Prices float by zone: HikaShop then stores only the incl-tax amount.
	floating_tax_prices: boolean;
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
