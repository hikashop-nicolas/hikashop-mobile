import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail, ProductMeta, ProductField, ProductImage, ProductFile, FieldFile, RelatedProduct, Settings, Access } from '../core';
import { WRITABLE_FIELD_TYPES, tsToDate, dateToTs } from '../core';
import { Screen, Spinner, Icon, Field, TreeSelect, Money, Button, RichText, CustomFieldInput, DeleteButton } from '../ui';
import type { TreeNode } from '../ui';
import { CategoryEditor } from './CategoryEditor';
import { ProductMediaSection } from './ProductMediaSection';
import { RelatedProducts } from './RelatedProducts';
import { AccessField, ACCESS_ALL, accessSummary, toAccess } from './AccessField';
import { CategoryPicker } from './CategoryPicker';
import { useUnsavedChanges, useConfirmLeave } from '../app/unsaved';
import { useDataChanged } from '../app/data-changed';

// Everything the form edits as a scalar. Access is structured, so it has its own state.
type Form = Record<string, string | boolean>;

function toForm(p: ProductDetail): Form {
	return {
		name: p.name, code: p.code, description: p.description, published: p.published,
		msrp: String(p.msrp || ''), gtin: p.gtin, condition: p.condition,
		weight: String(p.weight || ''), weight_unit: p.weight_unit || 'kg',
		width: String(p.width || ''), height: String(p.height || ''), length: String(p.length || ''),
		dimension_unit: p.dimension_unit || 'cm',
		min_per_order: String(p.min_per_order || ''), max_per_order: String(p.max_per_order || ''),
		tax_id: String(p.tax_id || 0), manufacturer_id: String(p.manufacturer_id || 0),
		contact: p.contact, warehouse_id: String(p.warehouse_id || 0),
		sale_start: tsToDate(p.sale_start), sale_end: tsToDate(p.sale_end),
		page_title: p.page_title, meta_description: p.meta_description, keywords: p.keywords,
		canonical: p.canonical, alias: p.alias, url: p.url,
	};
}

const num = (v: unknown) => (v === '' || v == null ? 0 : Number(v));
const int = (v: unknown) => Math.trunc(num(v));

export function ProductEdit() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const confirmLeave = useConfirmLeave();
	const changed = useDataChanged();
	const t = useT();
	const storeId = active?.id ?? '';
	const productId = Number(id);

	const { data: fetched, loading, error } = useCached<ProductDetail>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getProduct(storeId, productId),
		fetch: () => client!.getProduct(productId),
		write: async (p) => { await cache.putProduct(storeId, productId, p); },
		deps: [storeId, productId],
	});
	const { data: meta } = useCached<ProductMeta>({
		enabled: !!client && !!active,
		read: () => cache.getProductMeta(storeId),
		fetch: () => client!.getProductMeta(),
		write: async (m) => { await cache.putProductMeta(storeId, m); },
		deps: [storeId],
	});
	const { data: settings } = useCached<Settings>({
		enabled: !!client && !!active,
		read: () => cache.getSettings(storeId),
		fetch: () => client!.getSettings(),
		write: async (s) => { await cache.putSettings(storeId, s); },
		deps: [storeId],
	});

	const [form, setForm] = useState<Form | null>(null);
	const [access, setAccess] = useState<Access>(ACCESS_ALL);
	const [cats, setCats] = useState<number[]>([]);
	const [manufacturerId, setManufacturerId] = useState<number>(0);
	const [custom, setCustom] = useState<Record<string, string>>({});
	const [customFiles, setCustomFiles] = useState<Record<string, FieldFile[]>>({});
	const [stockInput, setStockInput] = useState('');
	const [stockBusy, setStockBusy] = useState(false);
	const [media, setMedia] = useState<{ images: ProductImage[]; files: ProductFile[] } | null>(null);
	const [related, setRelated] = useState<{ bundle: RelatedProduct[]; options: RelatedProduct[]; related: RelatedProduct[] } | null>(null);
	const [tags, setTags] = useState<number[]>([]);
	// Which record the form currently holds. A background refresh of the same record must not
	// overwrite what is being typed; a different record must replace it.
	const formFor = useRef<number | null>(null);
	useEffect(() => {
		if (fetched && formFor.current !== fetched.id) {
			formFor.current = fetched.id;
			setForm(toForm(fetched));
			setAccess(toAccess(fetched.access));
			setCats(fetched.categories.map((c) => c.id));
			setManufacturerId(fetched.manufacturer_id || 0);
			setStockInput(fetched.quantity >= 0 ? String(fetched.quantity) : '');
			setMedia({ images: fetched.images, files: fetched.files });
			setRelated({ bundle: fetched.bundle ?? [], options: fetched.options ?? [], related: fetched.related ?? [] });
			setTags(fetched.tags ?? []);
			const cf: Record<string, string> = {};
			for (const [k, v] of Object.entries(fetched.custom_fields ?? {})) cf[k] = v ?? '';
			setCustom(cf);
			setCustomFiles(fetched.custom_field_files ?? {});
		}
	}, [fetched, form]);

	// Whether the form differs from the record it was loaded from, so the shell can ask before
	// opening another one. Compared against the record rather than tracked as a "touched" flag,
	// so typing something and undoing it does not leave a warning behind. Stock, media, related
	// products and custom-field files each save on their own and are not part of this.
	const signature = (
		f: Form | null, a: Access, c: number[], brand: number, cf: Record<string, string>, tg: number[],
	) => JSON.stringify([f, a, [...c].sort((x, y) => x - y), brand, cf, [...tg].sort((x, y) => x - y)]);

	const baseline = fetched
		? signature(
			toForm(fetched),
			toAccess(fetched.access),
			fetched.categories.map((c) => c.id),
			fetched.manufacturer_id || 0,
			Object.fromEntries(Object.entries(fetched.custom_fields ?? {}).map(([k, v]) => [k, v ?? ''])),
			fetched.tags ?? [],
		)
		: null;
	useUnsavedChanges(!!form && baseline !== null && signature(form, access, cats, manufacturerId, custom, tags) !== baseline);

	async function saveStock() {
		if (!client || stockBusy) return;
		setStockBusy(true);
		try {
			const q = stockInput.trim() === '' ? -1 : parseInt(stockInput, 10) || 0;
			const res = await client.setProductStock(productId, q);
			setStockInput(res.quantity >= 0 ? String(res.quantity) : '');
		} catch { /* surfaced on the next fetch */ }
		finally { setStockBusy(false); }
	}

	// Local copies of the pickable trees so a freshly created node shows up at once.

	// Which create modal is open (a category or a manufacturer), if any.
	const [editorKind, setEditorKind] = useState<'product' | 'manufacturer' | null>(null);

	const [busy, setBusy] = useState(false);
	const [saveErr, setSaveErr] = useState('');

	// A category created from here is selected straight away. The picker resolves its name by id,
	// so there is no local copy of the tree to keep in step any more.
	function onCategoryCreated(node: TreeNode) {
		setCats((c) => (c.includes(node.id) ? c : [...c, node.id]));
		setEditorKind(null);
	}
	function onBrandCreated(node: TreeNode) {
		setManufacturerId(node.id);
		setEditorKind(null);
	}

	function set<K extends string>(key: K, value: string | boolean) {
		setForm((f) => (f ? { ...f, [key]: value } : f));
	}

	// Prefer the definitions the product came with: a field can be restricted to certain
	// categories or products, so only the product's own list reflects what actually applies.
	// The meta list is the fallback for a product being created, which has no row yet.
	const fields: ProductField[] = fetched?.fields ?? meta?.product_fields ?? [];
	const isWritable = (f: ProductField) => WRITABLE_FIELD_TYPES.includes(f.type);
	function setCustomField(namekey: string, value: string) {
		setCustom((c) => ({ ...c, [namekey]: value }));
	}
	// An ajax field's column value is the pipe-joined path list of its files.
	function setCustomFieldFiles(namekey: string, next: FieldFile[]) {
		setCustomFiles((cf) => ({ ...cf, [namekey]: next }));
		setCustom((c) => ({ ...c, [namekey]: next.map((f) => f.path).join('|') }));
	}
	// Only send the fields the connector can actually write.
	function writableCustom(): Record<string, string> {
		const out: Record<string, string> = {};
		for (const f of fields) if (isWritable(f) && f.namekey in custom) out[f.namekey] = custom[f.namekey] ?? '';
		return out;
	}

	async function save() {
		if (!client || !form || busy) return;
		setSaveErr('');
		setBusy(true);
		try {
			const body = {
				name: form.name, code: form.code, description: form.description, published: form.published,
				msrp: num(form.msrp), gtin: form.gtin, condition: form.condition,
				weight: num(form.weight), weight_unit: form.weight_unit,
				width: num(form.width), height: num(form.height), length: num(form.length), dimension_unit: form.dimension_unit,
				min_per_order: int(form.min_per_order), max_per_order: int(form.max_per_order),
				tax_id: int(form.tax_id), manufacturer_id: manufacturerId,
				access, contact: form.contact, warehouse_id: int(form.warehouse_id),
				sale_start: dateToTs(form.sale_start as string), sale_end: dateToTs(form.sale_end as string),
				page_title: form.page_title, meta_description: form.meta_description, keywords: form.keywords,
				canonical: form.canonical, alias: form.alias, url: form.url,
				tags,
				custom_fields: writableCustom(),
				...(related ? {
					bundle: related.bundle.map((r) => ({ id: r.id, quantity: r.quantity })),
					options: related.options.map((r) => ({ id: r.id })),
					related: related.related.map((r) => ({ id: r.id })),
				} : {}),
			};
			const updated = await client.updateProduct(productId, body);
			const categories = await client.setProductCategories(productId, cats);
			await cache.putProduct(storeId, productId, { ...updated, categories });
			changed.bump('products');
			nav('/products');
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setSaveErr(tError(t, code));
		} finally {
			setBusy(false);
		}
	}

	async function del() {
		if (!client || busy) return;
		setSaveErr('');
		setBusy(true);
		try {
			await client.deleteProduct(productId);
			changed.bump('products');
			nav('/products');
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setSaveErr(tError(t, code));
		} finally {
			setBusy(false);
		}
	}

	const s = (k: string) => (form?.[k] as string) ?? '';

	return (
		<Screen
			title={t('product.editTitle')}
			left={<button className="hk-iconbtn" onClick={() => confirmLeave(() => nav('/products'))} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={form ? (
				<Button variant="pri" size="sm" disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</Button>
			) : undefined}
		>
			{loading || !form ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : (
				<div className="hk-bento">
					<div className="hk-card hk-card--pad hk-form">
						<span className="hk-muted">{t('product.basics')}</span>
						<Field label={t('product.name')}><input className="hk-input" value={s('name')} onChange={(e) => set('name', e.target.value)} /></Field>
						<Field label={t('product.sku')}><input className="hk-input hk-input-mono" value={s('code')} onChange={(e) => set('code', e.target.value)} /></Field>
						<label className="hk-check"><input type="checkbox" checked={!!form.published} onChange={(e) => set('published', e.target.checked)} /><span>{t('product.publishedLabel')}</span></label>
						{settings?.product_contact && (
							<label className="hk-check"><input type="checkbox" checked={!!form.contact} onChange={(e) => set('contact', e.target.checked)} /><span>{t('product.contact')}</span></label>
						)}
						<Field label={t('product.description')}><RichText value={s('description')} onChange={(html) => set('description', html)} /></Field>
						<div className="hk-form-row">
							<Field label={t('product.msrp')}><input className="hk-input" type="number" inputMode="decimal" value={s('msrp')} onChange={(e) => set('msrp', e.target.value)} /></Field>
							<Field label={t('product.gtin')}><input className="hk-input" value={s('gtin')} onChange={(e) => set('gtin', e.target.value)} /></Field>
						</div>
						<Field label={t('product.condition')}><input className="hk-input" value={s('condition')} onChange={(e) => set('condition', e.target.value)} /></Field>
					</div>

					<div className="hk-card hk-card--pad hk-form">
						<span className="hk-muted">{t('product.inventory')}</span>
						<div className="hk-form-row">
							<Field label={t('product.weight')}><input className="hk-input" type="number" inputMode="decimal" value={s('weight')} onChange={(e) => set('weight', e.target.value)} /></Field>
							<Field label={t('product.unit')}>
								<select className="hk-select" value={s('weight_unit')} onChange={(e) => set('weight_unit', e.target.value)}>
									{(meta?.weight_units ?? ['g', 'kg']).map((u) => <option key={u} value={u}>{u}</option>)}
								</select>
							</Field>
						</div>
						<div className="hk-form-row hk-form-row--3">
							<Field label={t('product.width')}><input className="hk-input" type="number" inputMode="decimal" value={s('width')} onChange={(e) => set('width', e.target.value)} /></Field>
							<Field label={t('product.height')}><input className="hk-input" type="number" inputMode="decimal" value={s('height')} onChange={(e) => set('height', e.target.value)} /></Field>
							<Field label={t('product.length')}><input className="hk-input" type="number" inputMode="decimal" value={s('length')} onChange={(e) => set('length', e.target.value)} /></Field>
						</div>
						<Field label={t('product.unit')}>
							<select className="hk-select" value={s('dimension_unit')} onChange={(e) => set('dimension_unit', e.target.value)}>
								{(meta?.dimension_units ?? ['cm', 'in']).map((u) => <option key={u} value={u}>{u}</option>)}
							</select>
						</Field>
						<div className="hk-form-row">
							<Field label={t('product.minPerOrder')}><input className="hk-input" type="number" inputMode="numeric" value={s('min_per_order')} onChange={(e) => set('min_per_order', e.target.value)} /></Field>
							<Field label={t('product.maxPerOrder')}><input className="hk-input" type="number" inputMode="numeric" value={s('max_per_order')} onChange={(e) => set('max_per_order', e.target.value)} /></Field>
						</div>
						{(meta?.warehouses ?? []).length > 0 && (
							<Field label={t('product.warehouse')}>
								<select className="hk-select" value={s('warehouse_id')} onChange={(e) => set('warehouse_id', e.target.value)}>
									<option value="0">{t('product.none')}</option>
									{meta!.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
								</select>
							</Field>
						)}
						<div className="hk-form-row">
							<Field label={t('product.saleStart')}><input className="hk-input" type="date" value={s('sale_start')} onChange={(e) => set('sale_start', e.target.value)} /></Field>
							<Field label={t('product.saleEnd')}><input className="hk-input" type="date" value={s('sale_end')} onChange={(e) => set('sale_end', e.target.value)} /></Field>
						</div>
					</div>

					<div className="hk-card hk-card--pad hk-form">
						<span className="hk-muted">{t('product.organization')}</span>
						<Field label={t('product.categories')}>
							<CategoryPicker type="product" selected={cats} onChange={setCats}
								searchPlaceholder={t('product.searchCategories')} emptyLabel={t('product.noCategories')}
								onAddRequest={() => setEditorKind('product')} addLabel={t('product.addCategory')} />
						</Field>
						<Field label={t('product.manufacturer')}>
							<CategoryPicker type="manufacturer" selected={manufacturerId ? [manufacturerId] : []}
								onChange={(ids) => setManufacturerId(ids[0] ?? 0)} multiple={false}
								searchPlaceholder={t('product.searchBrands')} emptyLabel={t('product.noBrands')}
								onAddRequest={() => setEditorKind('manufacturer')} addLabel={t('product.addBrand')} />
						</Field>
						<Field label={t('product.tax')}>
							<select className="hk-select" value={s('tax_id')} onChange={(e) => set('tax_id', e.target.value)}>
								<option value="0">{t('product.none')}</option>
								{(meta?.tax_categories ?? []).map((tc) => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
							</select>
						</Field>
						<AccessField label={t('product.access')} value={access} onChange={setAccess} />
						{(meta?.tags ?? []).length > 0 && (
							<Field label={t('product.tags')}>
								<TreeSelect nodes={meta!.tags} selected={tags} onChange={setTags}
									searchPlaceholder={t('product.searchTags')} emptyLabel={t('product.noTags')} />
							</Field>
						)}
					</div>

					<div className="hk-card hk-card--pad">
						<div className="hk-sect-head"><span className="hk-muted">{t('product.pricing')}</span>
							<Button size="sm" onClick={() => nav(`/products/${productId}/prices`)}><Icon name="edit" size={15} /> {t('product.edit')}</Button></div>
						{(fetched?.prices ?? []).length === 0 ? (
							<div className="hk-empty">{t('product.noPrice')}</div>
						) : fetched!.prices.map((p) => (
							<div key={p.id} className="hk-row">
								<div className="hk-row-grow"><span className="hk-row-title"><Money value={p.value} currency={p.currency_id} /></span>
									{(p.min_quantity > 1 || accessSummary(p.access, t)) && <span className="hk-row-sub">{p.min_quantity > 1 ? t('product.priceFrom', { qty: p.min_quantity }) : ''}{accessSummary(p.access, t) ? ` · ${accessSummary(p.access, t)}` : ''}</span>}</div>
							</div>
						))}
					</div>

					{fetched && fetched.variants.length === 0 && (
						<div className="hk-card hk-card--pad hk-form">
							<span className="hk-muted">{t('product.stock')}</span>
							<div className="hk-form-row">
								<input className="hk-input" type="number" inputMode="numeric" value={stockInput} placeholder={t('product.unlimited')}
									disabled={stockBusy} onChange={(e) => setStockInput(e.target.value)} />
								<Button variant="pri" disabled={stockBusy} onClick={() => void saveStock()}><Icon name="check" size={16} /> {stockBusy ? t('product.saving') : t('product.updateStock')}</Button>
							</div>
						</div>
					)}

					{media && (
						<ProductMediaSection productId={productId} images={media.images} files={media.files}
							onChange={(images, files) => setMedia({ images, files })} />
					)}

					<div className="hk-card hk-card--pad">
						<div className="hk-sect-head"><span className="hk-muted">{t('product.variants')}</span>
							<Button size="sm" onClick={() => nav(`/products/${productId}/variants`)}><Icon name="edit" size={15} /> {t('product.edit')}</Button></div>
						<div className="hk-row-sub">{t('product.variantsSummary', { options: fetched?.characteristics.length ?? 0, count: fetched?.variants.length ?? 0 })}</div>
					</div>

					{related && (
						<RelatedProducts productId={productId} bundle={related.bundle} options={related.options} related={related.related}
							showBundle={meta?.bundle_supported ?? false}
							onChange={(kind, items) => setRelated((r) => (r ? { ...r, [kind]: items } : r))} />
					)}

					<div className="hk-card hk-card--pad hk-form">
						<span className="hk-muted">{t('product.seo')}</span>
						<Field label={t('product.pageTitle')}><input className="hk-input" value={s('page_title')} onChange={(e) => set('page_title', e.target.value)} /></Field>
						<Field label={t('product.metaDescription')}><textarea className="hk-input hk-textarea" rows={2} value={s('meta_description')} onChange={(e) => set('meta_description', e.target.value)} /></Field>
						<Field label={t('product.keywords')}><input className="hk-input" value={s('keywords')} onChange={(e) => set('keywords', e.target.value)} /></Field>
						<Field label={t('product.alias')} hint={t('product.aliasHint')}><input className="hk-input hk-input-mono" value={s('alias')} onChange={(e) => set('alias', e.target.value)} /></Field>
						<Field label={t('product.canonical')}><input className="hk-input" value={s('canonical')} onChange={(e) => set('canonical', e.target.value)} /></Field>
						<Field label={t('product.urlRedirect')}><input className="hk-input" value={s('url')} onChange={(e) => set('url', e.target.value)} /></Field>
					</div>

					{fields.length > 0 && (
						<div className="hk-card hk-card--pad hk-form">
							<span className="hk-muted">{t('product.customFields')}</span>
							{fields.map((f) => (
								<CustomFieldInput key={f.namekey} field={f} value={custom[f.namekey] ?? ''} files={customFiles[f.namekey] ?? []}
									readOnlyLabel={t('product.fieldReadOnly')}
									onChange={(v) => setCustomField(f.namekey, v)}
									onUpload={(data, name) => client!.uploadFieldFile('product', f.namekey, { data, name })}
									onFiles={(next) => setCustomFieldFiles(f.namekey, next)} />
							))}
						</div>
					)}

					{saveErr && <div className="hk-error-note">{saveErr}</div>}

					<DeleteButton block disabled={busy} label={t('product.deleteProduct')}
						confirmMessage={t('product.deleteConfirm', { name: (form?.name as string) || '' })}
						onConfirm={() => void del()} />
				</div>
			)}
			{editorKind && (
				<CategoryEditor
					kind={editorKind}
					meta={meta}
					onClose={() => setEditorKind(null)}
					onSaved={editorKind === 'manufacturer' ? onBrandCreated : onCategoryCreated}
				/>
			)}
		</Screen>
	);
}
