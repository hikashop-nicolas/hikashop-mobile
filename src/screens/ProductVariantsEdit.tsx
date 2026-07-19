import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail, ProductMeta, ProductCharacteristic, ProductVariant } from '../core';
import { Screen, Spinner, Icon, Money } from '../ui';

// Variants management: the option set (characteristics + values) plus a listing of
// variants. Editing a variant opens its own edit screen; adding one creates a blank
// variant and opens it.
export function ProductVariantsEdit() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const t = useT();
	const storeId = active?.id ?? '';
	const productId = Number(id);
	const [bump, setBump] = useState(0);

	const { data: product, loading, error } = useCached<ProductDetail>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getProduct(storeId, productId),
		fetch: () => client!.getProduct(productId),
		write: async (p) => { await cache.putProduct(storeId, productId, p); },
		deps: [storeId, productId, bump],
	});
	const { data: meta } = useCached<ProductMeta>({
		enabled: !!client && !!active,
		read: () => cache.getProductMeta(storeId),
		fetch: () => client!.getProductMeta(),
		write: async (m) => { await cache.putProductMeta(storeId, m); },
		deps: [storeId],
	});

	const [options, setOptions] = useState<ProductCharacteristic[] | null>(null);
	useEffect(() => { if (product && options === null) setOptions(product.characteristics.map((c) => ({ ...c, values: [...c.values] }))); }, [product, options]);

	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const [newValue, setNewValue] = useState<Record<number, string>>({});
	const [newOption, setNewOption] = useState('');
	const [pickOption, setPickOption] = useState('');

	const availableOptions = (meta?.characteristics ?? []).filter((mc) => !(options ?? []).some((o) => o.id === mc.id));

	async function addValue(optionId: number) {
		const text = (newValue[optionId] ?? '').trim();
		if (!client || !text || busy) return;
		setBusy(true); setErr('');
		try {
			const created = await client.createCharacteristic({ parent_id: optionId, value: text });
			setOptions((os) => os ? os.map((o) => o.id === optionId ? { ...o, values: [...o.values, { id: created.id, value: created.value }] } : o) : os);
			setNewValue((m) => ({ ...m, [optionId]: '' }));
		} catch (e) { setErr(codeOf(e, t)); } finally { setBusy(false); }
	}
	async function addOption() {
		const text = newOption.trim();
		if (!client || !text || busy) return;
		setBusy(true); setErr('');
		try {
			const created = await client.createCharacteristic({ value: text });
			setOptions((os) => [...(os ?? []), { id: created.id, name: created.value, values: [] }]);
			setNewOption('');
		} catch (e) { setErr(codeOf(e, t)); } finally { setBusy(false); }
	}
	function addExistingOption() {
		const mc = (meta?.characteristics ?? []).find((c) => c.id === Number(pickOption));
		if (!mc) return;
		setOptions((os) => [...(os ?? []), { id: mc.id, name: mc.name, values: [...mc.values] }]);
		setPickOption('');
	}

	// Append a blank variant through the reconcile endpoint, then open its edit screen.
	async function addVariant() {
		if (!client || !product || busy) return;
		setBusy(true); setErr('');
		try {
			const existing = product.variants.map((v) => ({
				id: v.id,
				value_ids: v.values.map((x) => x.value_id).filter((x) => x > 0),
				code: v.code, quantity: v.quantity, published: v.published,
				price: v.price, currency_id: meta?.currencies[0]?.id ?? 1,
			}));
			const oldIds = new Set(product.variants.map((v) => v.id));
			const res = await client.setProductVariants(productId, [...existing, { value_ids: [], code: '', quantity: -1, published: false, price: null, currency_id: meta?.currencies[0]?.id ?? 1 }]);
			const created = res.variants.find((v) => !oldIds.has(v.id));
			if (product) await cache.putProduct(storeId, productId, { ...product, characteristics: res.characteristics, variants: res.variants });
			if (created) nav(`/products/${productId}/variants/${created.id}`);
			else setBump((b) => b + 1);
		} catch (e) { setErr(codeOf(e, t)); setBusy(false); }
	}

	async function del(variantId: number) {
		if (!client || !product || busy) return;
		if (!window.confirm(t('product.deleteVariantConfirm'))) return;
		setBusy(true); setErr('');
		try {
			const kept = product.variants.filter((v) => v.id !== variantId).map((v) => ({
				id: v.id, value_ids: v.values.map((x) => x.value_id).filter((x) => x > 0),
				code: v.code, quantity: v.quantity, published: v.published, price: v.price, currency_id: meta?.currencies[0]?.id ?? 1,
			}));
			const res = await client.setProductVariants(productId, kept);
			await cache.putProduct(storeId, productId, { ...product, characteristics: res.characteristics, variants: res.variants });
			setBump((b) => b + 1);
		} catch (e) { setErr(codeOf(e, t)); } finally { setBusy(false); }
	}

	function label(v: ProductVariant): string { return v.values.map((x) => x.value).join(' / ') || v.code || `#${v.id}`; }

	return (
		<Screen
			title={t('product.editVariants')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={<button className="hk-appbar-act" disabled={busy} onClick={() => void addVariant()}><span className="hk-btn-ic"><Icon name="plus" size={18} /> {t('product.addVariant')}</span></button>}
		>
			{loading || options === null ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : (
				<div className="hk-bento">
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('product.options')}</span>
						{options.map((o) => (
							<div key={o.id} className="hk-form" style={{ marginTop: 'var(--hk-s2)' }}>
								<div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hk-s2)', alignItems: 'center' }}>
									<span className="hk-row-title" style={{ minWidth: '3.5rem' }}>{o.name}</span>
									{o.values.map((v) => <span key={v.id} className="hk-chip">{v.value}</span>)}
								</div>
								<div style={{ display: 'flex', gap: 'var(--hk-s2)' }}>
									<input className="hk-input" placeholder={t('product.addValue')} value={newValue[o.id] ?? ''} onChange={(e) => setNewValue((m) => ({ ...m, [o.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') void addValue(o.id); }} />
									<button className="hk-btn" disabled={busy} onClick={() => void addValue(o.id)}>{t('common.add')}</button>
								</div>
							</div>
						))}
						{availableOptions.length > 0 && (
							<div style={{ display: 'flex', gap: 'var(--hk-s2)', marginTop: 'var(--hk-s3)' }}>
								<select className="hk-select" value={pickOption} onChange={(e) => setPickOption(e.target.value)}>
									<option value="">{t('product.addExistingOption')}</option>
									{availableOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
								</select>
								<button className="hk-btn" disabled={busy || !pickOption} onClick={addExistingOption}>{t('common.add')}</button>
							</div>
						)}
						<div style={{ display: 'flex', gap: 'var(--hk-s2)', marginTop: 'var(--hk-s2)' }}>
							<input className="hk-input" placeholder={t('product.newOption')} value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addOption(); }} />
							<button className="hk-btn" disabled={busy} onClick={() => void addOption()}>{t('product.addOption')}</button>
						</div>
					</div>

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('product.variants')}</span>
						{(product?.variants ?? []).length === 0 ? (
							<div className="hk-empty">{t('product.noVariants')}</div>
						) : (product?.variants ?? []).map((v) => (
							<div key={v.id} className="hk-row">
								<button type="button" className="hk-row-grow hk-row-btn" onClick={() => nav(`/products/${productId}/variants/${v.id}`)}>
									<span className="hk-row-title">{label(v)}{!v.published && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('product.unpublished')}</span>}</span>
									<span className="hk-row-sub hk-mono">{v.code}{v.quantity >= 0 ? ` · ${v.quantity}` : ''}</span>
								</button>
								{v.price != null && <span className="hk-row-rt"><Money value={v.price} currency={meta?.currencies[0]?.id} /></span>}
								<button type="button" className="hk-iconbtn hk-danger" disabled={busy} onClick={() => void del(v.id)} aria-label={t('common.delete')}><Icon name="trash" size={18} /></button>
							</div>
						))}
					</div>

					{err && <div className="hk-error-note">{err}</div>}
				</div>
			)}
		</Screen>
	);
}

function codeOf(e: unknown, t: ReturnType<typeof useT>): string {
	const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
	return tError(t, code);
}
