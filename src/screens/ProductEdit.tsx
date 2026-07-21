import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail, ProductMeta, ProductField, ProductImage, ProductFile, FieldFile, RelatedProduct } from '../core';
import { WRITABLE_FIELD_TYPES } from '../core';
import { Screen, Spinner, Icon, Field, TreeSelect, Money, Button, RichText, CustomFieldInput } from '../ui';
import type { TreeNode } from '../ui';
import { CategoryEditor } from './CategoryEditor';
import { ProductMediaSection } from './ProductMediaSection';
import { RelatedProducts } from './RelatedProducts';

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
		page_title: p.page_title, meta_description: p.meta_description, keywords: p.keywords,
	};
}

const num = (v: unknown) => (v === '' || v == null ? 0 : Number(v));
const int = (v: unknown) => Math.trunc(num(v));

export function ProductEdit() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
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

	const [form, setForm] = useState<Form | null>(null);
	const [cats, setCats] = useState<number[]>([]);
	const [manufacturerId, setManufacturerId] = useState<number>(0);
	const [custom, setCustom] = useState<Record<string, string>>({});
	const [customFiles, setCustomFiles] = useState<Record<string, FieldFile[]>>({});
	const [stockInput, setStockInput] = useState('');
	const [stockBusy, setStockBusy] = useState(false);
	const [media, setMedia] = useState<{ images: ProductImage[]; files: ProductFile[] } | null>(null);
	const [related, setRelated] = useState<{ bundle: RelatedProduct[]; options: RelatedProduct[]; related: RelatedProduct[] } | null>(null);
	useEffect(() => {
		if (fetched && !form) {
			setForm(toForm(fetched));
			setCats(fetched.categories.map((c) => c.id));
			setManufacturerId(fetched.manufacturer_id || 0);
			setStockInput(fetched.quantity >= 0 ? String(fetched.quantity) : '');
			setMedia({ images: fetched.images, files: fetched.files });
			setRelated({ bundle: fetched.bundle ?? [], options: fetched.options ?? [], related: fetched.related ?? [] });
			const cf: Record<string, string> = {};
			for (const [k, v] of Object.entries(fetched.custom_fields ?? {})) cf[k] = v ?? '';
			setCustom(cf);
			setCustomFiles(fetched.custom_field_files ?? {});
		}
	}, [fetched, form]);

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
	const [catNodes, setCatNodes] = useState<TreeNode[]>([]);
	const [brandNodes, setBrandNodes] = useState<TreeNode[]>([]);
	useEffect(() => { if (meta) { setCatNodes(meta.categories); setBrandNodes(meta.manufacturers); } }, [meta]);

	// Which create modal is open (a category or a manufacturer), if any.
	const [editorKind, setEditorKind] = useState<'product' | 'manufacturer' | null>(null);

	const [busy, setBusy] = useState(false);
	const [saveErr, setSaveErr] = useState('');

	function onCategoryCreated(node: TreeNode) {
		setCatNodes((ns) => [...ns, node]);
		setCats((c) => (c.includes(node.id) ? c : [...c, node.id]));
		setEditorKind(null);
	}
	function onBrandCreated(node: TreeNode) {
		setBrandNodes((ns) => [...ns, node]);
		setManufacturerId(node.id);
		setEditorKind(null);
	}

	function set<K extends string>(key: K, value: string | boolean) {
		setForm((f) => (f ? { ...f, [key]: value } : f));
	}

	const fields: ProductField[] = meta?.product_fields ?? [];
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
				page_title: form.page_title, meta_description: form.meta_description, keywords: form.keywords,
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
			nav(-1);
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setSaveErr(tError(t, code));
		} finally {
			setBusy(false);
		}
	}

	async function del() {
		if (!client || busy) return;
		if (!window.confirm(t('product.deleteConfirm', { name: (form?.name as string) || '' }))) return;
		setSaveErr('');
		setBusy(true);
		try {
			await client.deleteProduct(productId);
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
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={form ? <button className="hk-appbar-act" disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</button> : undefined}
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
					</div>

					<div className="hk-card hk-card--pad hk-form">
						<span className="hk-muted">{t('product.organization')}</span>
						<Field label={t('product.categories')}>
							<TreeSelect nodes={catNodes} selected={cats} onChange={setCats}
								searchPlaceholder={t('product.searchCategories')} emptyLabel={t('product.noCategories')}
								onAddRequest={() => setEditorKind('product')} addLabel={t('product.addCategory')} />
						</Field>
						<Field label={t('product.manufacturer')}>
							<TreeSelect nodes={brandNodes} selected={manufacturerId ? [manufacturerId] : []}
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
					</div>

					<div className="hk-card hk-card--pad">
						<div className="hk-sect-head"><span className="hk-muted">{t('product.pricing')}</span>
							<button className="hk-appbar-act" onClick={() => nav(`/products/${productId}/prices`)}>{t('product.edit')}</button></div>
						{(fetched?.prices ?? []).length === 0 ? (
							<div className="hk-empty">{t('product.noPrice')}</div>
						) : fetched!.prices.map((p) => (
							<div key={p.id} className="hk-row">
								<div className="hk-row-grow"><span className="hk-row-title"><Money value={p.value} currency={p.currency_id} /></span>
									{(p.min_quantity > 1 || p.access) && <span className="hk-row-sub">{p.min_quantity > 1 ? t('product.priceFrom', { qty: p.min_quantity }) : ''}{p.access ? ` · ${p.access}` : ''}</span>}</div>
							</div>
						))}
					</div>

					{fetched && fetched.variants.length === 0 && (
						<div className="hk-card hk-card--pad hk-form">
							<span className="hk-muted">{t('product.stock')}</span>
							<div className="hk-form-row">
								<input className="hk-input" type="number" inputMode="numeric" value={stockInput} placeholder={t('product.unlimited')}
									disabled={stockBusy} onChange={(e) => setStockInput(e.target.value)} />
								<Button variant="pri" disabled={stockBusy} onClick={() => void saveStock()}>{stockBusy ? t('product.saving') : t('product.updateStock')}</Button>
							</div>
						</div>
					)}

					{media && (
						<ProductMediaSection productId={productId} images={media.images} files={media.files}
							accessLevels={meta?.access_levels ?? []}
							onChange={(images, files) => setMedia({ images, files })} />
					)}

					<div className="hk-card hk-card--pad">
						<div className="hk-sect-head"><span className="hk-muted">{t('product.variants')}</span>
							<button className="hk-appbar-act" onClick={() => nav(`/products/${productId}/variants`)}>{t('product.edit')}</button></div>
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

					<div className="hk-card hk-card--pad">
						<button className="hk-btn hk-btn--danger hk-btn--block" disabled={busy} onClick={() => void del()}>{t('product.deleteProduct')}</button>
					</div>

					{saveErr && <div className="hk-error-note">{saveErr}</div>}
				</div>
			)}
			{editorKind && (
				<CategoryEditor
					kind={editorKind}
					meta={meta}
					parentNodes={editorKind === 'manufacturer' ? brandNodes : catNodes}
					onClose={() => setEditorKind(null)}
					onSaved={editorKind === 'manufacturer' ? onBrandCreated : onCategoryCreated}
				/>
			)}
		</Screen>
	);
}
