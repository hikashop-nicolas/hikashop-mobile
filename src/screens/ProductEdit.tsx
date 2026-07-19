import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail, ProductMeta, ProductField } from '../core';
import { WRITABLE_FIELD_TYPES } from '../core';
import { Screen, Spinner, Icon, Field } from '../ui';

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
	const [custom, setCustom] = useState<Record<string, string>>({});
	useEffect(() => {
		if (fetched && !form) {
			setForm(toForm(fetched));
			setCats(fetched.categories.map((c) => c.id));
			const cf: Record<string, string> = {};
			for (const [k, v] of Object.entries(fetched.custom_fields ?? {})) cf[k] = v ?? '';
			setCustom(cf);
		}
	}, [fetched, form]);

	const [busy, setBusy] = useState(false);
	const [saveErr, setSaveErr] = useState('');
	function toggleCat(cid: number) {
		setCats((c) => (c.includes(cid) ? c.filter((x) => x !== cid) : [...c, cid]));
	}

	function set<K extends string>(key: K, value: string | boolean) {
		setForm((f) => (f ? { ...f, [key]: value } : f));
	}

	const fields: ProductField[] = meta?.product_fields ?? [];
	const isWritable = (f: ProductField) => WRITABLE_FIELD_TYPES.includes(f.type);
	function setCustomField(namekey: string, value: string) {
		setCustom((c) => ({ ...c, [namekey]: value }));
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
				tax_id: int(form.tax_id), manufacturer_id: int(form.manufacturer_id),
				page_title: form.page_title, meta_description: form.meta_description, keywords: form.keywords,
				custom_fields: writableCustom(),
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
						<Field label={t('product.description')}><textarea className="hk-input hk-textarea" rows={4} value={s('description')} onChange={(e) => set('description', e.target.value)} /></Field>
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
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hk-s2)' }}>
								{(meta?.categories ?? []).map((c) => (
									<button key={c.id} type="button" className={`hk-chip${cats.includes(c.id) ? ' hk-on' : ''}`} onClick={() => toggleCat(c.id)}>{c.name}</button>
								))}
							</div>
						</Field>
						<Field label={t('product.manufacturer')}>
							<select className="hk-select" value={s('manufacturer_id')} onChange={(e) => set('manufacturer_id', e.target.value)}>
								<option value="0">{t('product.none')}</option>
								{(meta?.manufacturers ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
							</select>
						</Field>
						<Field label={t('product.tax')}>
							<select className="hk-select" value={s('tax_id')} onChange={(e) => set('tax_id', e.target.value)}>
								<option value="0">{t('product.none')}</option>
								{(meta?.tax_categories ?? []).map((tc) => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
							</select>
						</Field>
					</div>

					<div className="hk-card hk-card--pad hk-form">
						<span className="hk-muted">{t('product.seo')}</span>
						<Field label={t('product.pageTitle')}><input className="hk-input" value={s('page_title')} onChange={(e) => set('page_title', e.target.value)} /></Field>
						<Field label={t('product.metaDescription')}><textarea className="hk-input hk-textarea" rows={2} value={s('meta_description')} onChange={(e) => set('meta_description', e.target.value)} /></Field>
						<Field label={t('product.keywords')}><input className="hk-input" value={s('keywords')} onChange={(e) => set('keywords', e.target.value)} /></Field>
					</div>

					{fields.length > 0 && (
						<div className="hk-card hk-card--pad hk-form">
							<span className="hk-muted">{t('product.customFields')}</span>
							{fields.map((f) => {
								const val = custom[f.namekey] ?? '';
								if (!isWritable(f)) {
									return (
										<Field key={f.namekey} label={f.label}>
											<input className="hk-input" value={val} disabled readOnly />
											<span className="hk-muted" style={{ fontSize: '0.8em' }}>{t('product.fieldReadOnly')}</span>
										</Field>
									);
								}
								if (f.type === 'textarea') {
									return <Field key={f.namekey} label={f.label}><textarea className="hk-input hk-textarea" rows={3} value={val} onChange={(e) => setCustomField(f.namekey, e.target.value)} /></Field>;
								}
								if ((f.type === 'singledropdown' || f.type === 'radio') && f.options.length > 0) {
									return (
										<Field key={f.namekey} label={f.label}>
											<select className="hk-select" value={val} onChange={(e) => setCustomField(f.namekey, e.target.value)}>
												<option value="">{t('product.none')}</option>
												{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
											</select>
										</Field>
									);
								}
								const inputType = f.type === 'number' || f.type === 'integer' ? 'number' : f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : f.type === 'tel' ? 'tel' : f.type === 'color' ? 'color' : 'text';
								return <Field key={f.namekey} label={f.label}><input className="hk-input" type={inputType} value={val} onChange={(e) => setCustomField(f.namekey, e.target.value)} /></Field>;
							})}
						</div>
					)}

					<div className="hk-card hk-card--pad">
						<button className="hk-btn hk-btn--danger hk-btn--block" disabled={busy} onClick={() => void del()}>{t('product.deleteProduct')}</button>
					</div>

					{saveErr && <div className="hk-error-note">{saveErr}</div>}
				</div>
			)}
		</Screen>
	);
}
