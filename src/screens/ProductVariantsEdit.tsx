import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail, ProductMeta, ProductCharacteristic } from '../core';
import { Screen, Spinner, Icon, Field } from '../ui';

type VRow = { id?: number; valueIds: number[]; code: string; quantity: string; published: boolean; price: string };

export function ProductVariantsEdit() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const t = useT();
	const storeId = active?.id ?? '';
	const productId = Number(id);

	const { data: product, loading, error } = useCached<ProductDetail>({
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

	const [options, setOptions] = useState<ProductCharacteristic[] | null>(null);
	const [rows, setRows] = useState<VRow[] | null>(null);
	useEffect(() => {
		if (product && options === null) {
			setOptions(product.characteristics.map((c) => ({ ...c, values: [...c.values] })));
			setRows(product.variants.map((v) => ({
				id: v.id,
				valueIds: product.characteristics.map((c) => v.values.find((x) => x.option_id === c.id)?.value_id ?? 0),
				code: v.code, quantity: String(v.quantity < 0 ? '' : v.quantity), published: v.published, price: v.price != null ? String(v.price) : '',
			})));
		}
	}, [product, options]);

	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const [newValue, setNewValue] = useState<Record<number, string>>({});
	const [newOption, setNewOption] = useState('');
	const [pickOption, setPickOption] = useState('');
	const defaultCurrency = meta?.currencies[0]?.id ?? 1;

	// Existing shop characteristics not already on this product.
	const availableOptions = (meta?.characteristics ?? []).filter((mc) => !(options ?? []).some((o) => o.id === mc.id));

	function addExistingOption() {
		const optId = Number(pickOption);
		const mc = (meta?.characteristics ?? []).find((c) => c.id === optId);
		if (!mc) return;
		setOptions((os) => [...(os ?? []), { id: mc.id, name: mc.name, values: [...mc.values] }]);
		setRows((rs) => rs ? rs.map((r) => ({ ...r, valueIds: [...r.valueIds, 0] })) : rs);
		setPickOption('');
	}

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
			setRows((rs) => rs ? rs.map((r) => ({ ...r, valueIds: [...r.valueIds, 0] })) : rs);
			setNewOption('');
		} catch (e) { setErr(codeOf(e, t)); } finally { setBusy(false); }
	}

	function addRow() {
		setRows((rs) => [...(rs ?? []), { valueIds: (options ?? []).map(() => 0), code: '', quantity: '', published: true, price: '' }]);
	}
	function updateRow(i: number, patch: Partial<VRow>) {
		setRows((rs) => rs ? rs.map((r, idx) => idx === i ? { ...r, ...patch } : r) : rs);
	}
	function setRowValue(i: number, optIdx: number, valueId: number) {
		setRows((rs) => rs ? rs.map((r, idx) => idx === i ? { ...r, valueIds: r.valueIds.map((v, vi) => vi === optIdx ? valueId : v) } : r) : rs);
	}
	function removeRow(i: number) {
		setRows((rs) => rs ? rs.filter((_, idx) => idx !== i) : rs);
	}

	async function save() {
		if (!client || !rows || busy) return;
		setBusy(true); setErr('');
		try {
			const payload = rows.map((r) => ({
				id: r.id,
				value_ids: r.valueIds.filter((v) => v > 0),
				code: r.code,
				quantity: r.quantity.trim() === '' ? -1 : Number(r.quantity) || 0,
				published: r.published,
				price: r.price.trim() === '' ? null : Number(r.price),
				currency_id: defaultCurrency,
			}));
			const res = await client.setProductVariants(productId, payload);
			if (product) await cache.putProduct(storeId, productId, { ...product, characteristics: res.characteristics, variants: res.variants });
			nav(-1);
		} catch (e) { setErr(codeOf(e, t)); } finally { setBusy(false); }
	}

	return (
		<Screen
			title={t('product.editVariants')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={rows ? <button className="hk-appbar-act" disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</button> : undefined}
		>
			{loading || options === null || rows === null ? (
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
						{rows.map((r, i) => (
							<div key={i} className="hk-form" style={{ marginTop: 'var(--hk-s3)', paddingTop: 'var(--hk-s3)', borderTop: '1px solid var(--hk-line)' }}>
								<div className="hk-form-row">
									{options.map((o, optIdx) => (
										<Field key={o.id} label={o.name}>
											<select className="hk-select" value={r.valueIds[optIdx] ?? 0} onChange={(e) => setRowValue(i, optIdx, Number(e.target.value))}>
												<option value={0}>—</option>
												{o.values.map((v) => <option key={v.id} value={v.id}>{v.value}</option>)}
											</select>
										</Field>
									))}
								</div>
								<div className="hk-form-row">
									<Field label={t('product.sku')}><input className="hk-input hk-input-mono" value={r.code} onChange={(e) => updateRow(i, { code: e.target.value })} /></Field>
									<Field label={t('product.stock')}><input className="hk-input" type="number" inputMode="numeric" value={r.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })} /></Field>
								</div>
								<div className="hk-form-row">
									<Field label={t('product.price')}><input className="hk-input" type="number" inputMode="decimal" value={r.price} onChange={(e) => updateRow(i, { price: e.target.value })} /></Field>
									<label className="hk-check"><input type="checkbox" checked={r.published} onChange={(e) => updateRow(i, { published: e.target.checked })} /><span>{t('product.publishedLabel')}</span></label>
								</div>
								<button className="hk-btn hk-btn--danger" style={{ minHeight: '32px' }} onClick={() => removeRow(i)}>{t('common.delete')}</button>
							</div>
						))}
						<button className="hk-btn hk-btn--block" style={{ marginTop: 'var(--hk-s3)' }} onClick={addRow}><span className="hk-btn-ic"><Icon name="plus" size={18} /> {t('product.addVariant')}</span></button>
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
