import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail, ProductMeta, ProductField, ProductImage, ProductFile } from '../core';
import { WRITABLE_FIELD_TYPES } from '../core';
import { Screen, Spinner, Icon, Field, RichText } from '../ui';
import { ProductMediaSection } from './ProductMediaSection';

type Form = { code: string; quantity: string; price: string; currency_id: number; published: boolean };

// Edit one variant. Like the product editor but scoped to a variant: the option
// values it represents, code, stock, price, published, images and custom fields.
// No SEO and no brand / category (those belong to the parent product).
export function VariantEdit() {
	const { id, vid } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const t = useT();
	const storeId = active?.id ?? '';
	const productId = Number(id);
	const variantId = Number(vid);

	const { data: variant, loading, error } = useCached<ProductDetail>({
		enabled: !!client && !!active && !!vid,
		read: () => cache.getProduct(storeId, variantId),
		fetch: () => client!.getProduct(variantId),
		write: async (p) => { await cache.putProduct(storeId, variantId, p); },
		deps: [storeId, variantId],
	});
	const { data: parent } = useCached<ProductDetail>({
		enabled: !!client && !!active,
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
	const [values, setValues] = useState<Record<number, number>>({});
	const [custom, setCustom] = useState<Record<string, string>>({});
	const [media, setMedia] = useState<{ images: ProductImage[]; files: ProductFile[] } | null>(null);
	useEffect(() => {
		if (variant && parent && !form) {
			const p0 = variant.prices[0];
			setForm({ code: variant.code, quantity: variant.quantity >= 0 ? String(variant.quantity) : '', price: p0 ? String(p0.value) : '', currency_id: p0?.currency_id ?? 1, published: variant.published });
			const vids = variant.value_ids ?? [];
			const byOption: Record<number, number> = {};
			for (const o of parent.characteristics) byOption[o.id] = o.values.find((x) => vids.includes(x.id))?.id ?? 0;
			setValues(byOption);
			setMedia({ images: variant.images, files: variant.files });
			const cf: Record<string, string> = {};
			for (const [k, v] of Object.entries(variant.custom_fields ?? {})) cf[k] = v ?? '';
			setCustom(cf);
		}
	}, [variant, parent, form]);

	const [busy, setBusy] = useState(false);
	const [saveErr, setSaveErr] = useState('');
	const fields: ProductField[] = meta?.product_fields ?? [];
	const isWritable = (f: ProductField) => WRITABLE_FIELD_TYPES.includes(f.type);

	function writableCustom(): Record<string, string> {
		const out: Record<string, string> = {};
		for (const f of fields) if (isWritable(f) && f.namekey in custom) out[f.namekey] = custom[f.namekey] ?? '';
		return out;
	}

	async function save() {
		if (!client || !form || busy) return;
		setSaveErr(''); setBusy(true);
		try {
			const value_ids = Object.values(values).filter((v) => v > 0);
			const updated = await client.updateVariant(productId, variantId, {
				code: form.code,
				quantity: form.quantity.trim() === '' ? -1 : Number(form.quantity) || 0,
				published: form.published,
				price: form.price.trim() === '' ? null : Number(form.price),
				currency_id: form.currency_id,
				value_ids,
				custom_fields: writableCustom(),
			});
			await cache.putProduct(storeId, variantId, updated);
			nav(-1);
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setSaveErr(tError(t, code));
		} finally { setBusy(false); }
	}

	const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

	return (
		<Screen
			title={t('product.editVariant')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={form ? <button className="hk-appbar-act" disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</button> : undefined}
		>
			{loading || !form || !parent ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : (
				<div className="hk-bento">
					<div className="hk-card hk-card--pad hk-form">
						<span className="hk-muted">{t('product.options')}</span>
						{parent.characteristics.length === 0 ? (
							<div className="hk-muted">{t('product.noOptions')}</div>
						) : parent.characteristics.map((o) => (
							<Field key={o.id} label={o.name}>
								<select className="hk-select" value={values[o.id] ?? 0} onChange={(e) => setValues((m) => ({ ...m, [o.id]: Number(e.target.value) }))}>
									<option value={0}>—</option>
									{o.values.map((v) => <option key={v.id} value={v.id}>{v.value}</option>)}
								</select>
							</Field>
						))}
					</div>

					<div className="hk-card hk-card--pad hk-form">
						<span className="hk-muted">{t('product.details')}</span>
						<Field label={t('product.sku')}><input className="hk-input hk-input-mono" value={form.code} onChange={(e) => set({ code: e.target.value })} /></Field>
						<div className="hk-form-row">
							<Field label={t('product.stock')}><input className="hk-input" type="number" inputMode="numeric" value={form.quantity} placeholder={t('product.unlimited')} onChange={(e) => set({ quantity: e.target.value })} /></Field>
							<label className="hk-check"><input type="checkbox" checked={form.published} onChange={(e) => set({ published: e.target.checked })} /><span>{t('product.publishedLabel')}</span></label>
						</div>
						<div className="hk-form-row">
							<Field label={t('product.price')}><input className="hk-input" type="number" inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} /></Field>
							<Field label={t('product.currency')}>
								<select className="hk-select" value={form.currency_id} onChange={(e) => set({ currency_id: Number(e.target.value) })}>
									{(meta?.currencies ?? []).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
								</select>
							</Field>
						</div>
					</div>

					{media && (
						<ProductMediaSection productId={variantId} images={media.images} files={media.files}
							onChange={(images, files) => setMedia({ images, files })} />
					)}

					{fields.length > 0 && (
						<div className="hk-card hk-card--pad hk-form">
							<span className="hk-muted">{t('product.customFields')}</span>
							{fields.map((f) => {
								if (!isWritable(f)) return null;
								const val = custom[f.namekey] ?? '';
								const setV = (v: string) => setCustom((c) => ({ ...c, [f.namekey]: v }));
								if (f.type === 'wysiwyg') return <Field key={f.namekey} label={f.label}><RichText value={val} onChange={setV} /></Field>;
								if (f.type === 'textarea') return <Field key={f.namekey} label={f.label}><textarea className="hk-input hk-textarea" rows={3} value={val} onChange={(e) => setV(e.target.value)} /></Field>;
								if ((f.type === 'singledropdown' || f.type === 'radio') && f.options.length > 0) {
									return <Field key={f.namekey} label={f.label}><select className="hk-select" value={val} onChange={(e) => setV(e.target.value)}><option value="">{t('product.none')}</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>;
								}
								return <Field key={f.namekey} label={f.label}><input className="hk-input" value={val} onChange={(e) => setV(e.target.value)} /></Field>;
							})}
						</div>
					)}

					{saveErr && <div className="hk-error-note">{saveErr}</div>}
				</div>
			)}
		</Screen>
	);
}
