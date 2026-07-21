import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail, ProductMeta, ProductPrice, Settings } from '../core';
import { tsToDate, dateToTs, inclFromExcl, exclFromIncl } from '../core';
import { Screen, Spinner, Icon, Field } from '../ui';

// A row keeps the tax-exclusive value (what HikaShop stores) and preserves the
// users/zone restrictions so an edit never wipes them.
type Row = {
	value: string; currency_id: number; min_quantity: string; access: string;
	start: string; end: string; users: number[]; zone_ids: number[];
};

const toRow = (p: ProductPrice): Row => ({
	value: String(p.value), currency_id: p.currency_id, min_quantity: String(p.min_quantity || ''),
	access: p.access || 'all', start: tsToDate(p.start_date), end: tsToDate(p.end_date),
	users: p.users ?? [], zone_ids: p.zone_ids ?? [],
});

export function ProductPricesEdit() {
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
	const { data: settings } = useCached<Settings>({
		enabled: !!client && !!active,
		read: () => cache.getSettings(storeId),
		fetch: () => client!.getSettings(),
		write: async (s) => { await cache.putSettings(storeId, s); },
		deps: [storeId],
	});

	const [rows, setRows] = useState<Row[] | null>(null);
	useEffect(() => { if (product && !rows) setRows(product.prices.map(toRow)); }, [product, rows]);

	const [busy, setBusy] = useState(false);
	const [saveErr, setSaveErr] = useState('');
	const [confirmDel, setConfirmDel] = useState<number | null>(null);
	const defaultCurrency = meta?.currencies[0]?.id ?? 1;

	// Tax entry: the product carries the tax rate; when the shop enters prices with tax
	// (price_with_tax) or the tax is fixed, show a linked incl-tax field. When the tax
	// floats by zone (floating_tax_prices) HikaShop enters only the incl-tax amount.
	const taxRate = product?.tax_rate ?? 0;
	const showTax = taxRate > 0 && (settings?.price_with_tax || settings?.floating_tax_prices);
	const floating = !!settings?.floating_tax_prices;

	function update(i: number, patch: Partial<Row>) {
		setRows((r) => (r ? r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) : r));
	}
	// Editing the incl-tax field stores the derived excl-tax value.
	function updateIncl(i: number, inclStr: string) {
		const incl = Number(inclStr);
		update(i, { value: inclStr.trim() === '' ? '' : String(exclFromIncl(incl, taxRate)) });
	}
	function add() {
		setRows((r) => [...(r ?? []), { value: '', currency_id: defaultCurrency, min_quantity: '', access: 'all', start: '', end: '', users: [], zone_ids: [] }]);
	}
	function remove(i: number) {
		setRows((r) => (r ? r.filter((_, idx) => idx !== i) : r));
		setConfirmDel(null);
	}

	async function save() {
		if (!client || !rows || busy) return;
		setSaveErr('');
		setBusy(true);
		try {
			const prices = rows
				.filter((r) => r.value.trim() !== '')
				.map((r) => ({
					value: Number(r.value) || 0, currency_id: r.currency_id, min_quantity: Number(r.min_quantity) || 0,
					access: r.access || 'all', start_date: dateToTs(r.start), end_date: dateToTs(r.end),
					users: r.users, zone_ids: r.zone_ids,
				}));
			const updated = await client.setProductPrices(productId, prices);
			if (product) await cache.putProduct(storeId, productId, { ...product, prices: updated });
			nav(-1);
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setSaveErr(tError(t, code));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen
			title={t('product.editPrices')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={rows ? <button className="hk-appbar-act" disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</button> : undefined}
		>
			{loading || !rows ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : (
				<>
					{rows.map((r, i) => {
						const incl = r.value.trim() === '' ? '' : String(inclFromExcl(Number(r.value), taxRate));
						const restricted = r.users.length + r.zone_ids.length > 0;
						return (
							<div key={i} className="hk-card hk-card--pad hk-form">
								{!floating && (
									<div className="hk-form-row">
										<Field label={showTax ? t('product.valueExclTax') : t('product.value')}><input className="hk-input" type="number" inputMode="decimal" value={r.value} onChange={(e) => update(i, { value: e.target.value })} /></Field>
										<Field label={t('product.currency')}>
											<select className="hk-select" value={r.currency_id} onChange={(e) => update(i, { currency_id: Number(e.target.value) })}>
												{(meta?.currencies ?? []).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
											</select>
										</Field>
									</div>
								)}
								{showTax && (
									<div className="hk-form-row">
										<Field label={t('product.valueInclTax')}><input className="hk-input" type="number" inputMode="decimal" value={incl} onChange={(e) => updateIncl(i, e.target.value)} /></Field>
										{floating && (
											<Field label={t('product.currency')}>
												<select className="hk-select" value={r.currency_id} onChange={(e) => update(i, { currency_id: Number(e.target.value) })}>
													{(meta?.currencies ?? []).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
												</select>
											</Field>
										)}
									</div>
								)}
								<div className="hk-form-row">
									<Field label={t('product.minQuantity')}><input className="hk-input" type="number" inputMode="numeric" value={r.min_quantity} onChange={(e) => update(i, { min_quantity: e.target.value })} /></Field>
									<Field label={t('product.access')}>
										<select className="hk-select" value={r.access} onChange={(e) => update(i, { access: e.target.value })}>
											<option value="all">{t('product.allUsers')}</option>
											{(meta?.access_levels ?? []).map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
										</select>
									</Field>
								</div>
								<div className="hk-form-row">
									<Field label={t('product.priceStart')}><input className="hk-input" type="date" value={r.start} onChange={(e) => update(i, { start: e.target.value })} /></Field>
									<Field label={t('product.priceEnd')}><input className="hk-input" type="date" value={r.end} onChange={(e) => update(i, { end: e.target.value })} /></Field>
								</div>
								{restricted && <span className="hk-hint">{t('product.priceRestricted', { users: r.users.length, zones: r.zone_ids.length })}</span>}
								{confirmDel === i ? (
									<div className="hk-form-row">
										<button className="hk-btn" onClick={() => setConfirmDel(null)}>{t('common.cancel')}</button>
										<button className="hk-btn hk-btn--danger" onClick={() => remove(i)}>{t('product.confirmDelete')}</button>
									</div>
								) : (
									<button className="hk-btn hk-btn--danger" style={{ minHeight: '34px' }} onClick={() => setConfirmDel(i)}>{t('common.delete')}</button>
								)}
							</div>
						);
					})}
					<button className="hk-btn hk-btn--block" onClick={add}><span className="hk-btn-ic"><Icon name="plus" size={18} /> {t('product.addPrice')}</span></button>
					{saveErr && <div className="hk-error-note">{saveErr}</div>}
				</>
			)}
		</Screen>
	);
}
