import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { OrderDetail, OrderFee, TaxRate } from '../core';
import { Screen, Spinner, Icon, Field, Money, Button } from '../ui';

// The three editable order-level fees, in display order.
const FEE_TYPES = ['discount', 'shipping', 'payment'] as const;
type FeeType = typeof FEE_TYPES[number];
const FEE_LABEL: Record<FeeType, string> = { discount: 'order.discount', shipping: 'order.shipping', payment: 'order.paymentFee' };

// One fee's editable state: ex-tax amount, any number of tax-rate namekeys (like HikaShop's
// multi-rate fees), and the discount code.
type FeeRow = { amount: string; rates: string[]; code: string };

function toRow(fee: OrderFee): FeeRow {
	return { amount: fee.amount ? String(fee.amount) : '', rates: [...(fee.tax_namekeys ?? [])], code: fee.code ?? '' };
}

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

export function OrderFeesEdit() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const t = useT();
	const storeId = active?.id ?? '';
	const orderId = Number(id);

	const { data: order, loading, error } = useCached<OrderDetail>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getOrderDetail(storeId, orderId),
		fetch: () => client!.getOrder(orderId),
		write: async (o) => { await cache.putOrderDetail(storeId, orderId, o); },
		deps: [storeId, orderId],
	});

	const [rows, setRows] = useState<Record<FeeType, FeeRow> | null>(null);
	useEffect(() => {
		if (!order) return;
		setRows({ discount: toRow(order.fees.discount), shipping: toRow(order.fees.shipping), payment: toRow(order.fees.payment) });
	}, [order]);

	const [busy, setBusy] = useState(false);
	const [saveErr, setSaveErr] = useState('');

	const taxRates: TaxRate[] = order?.tax_rates ?? [];
	const rateOf = (namekey: string): number => taxRates.find((r) => r.namekey === namekey)?.rate ?? 0;

	function update(type: FeeType, patch: Partial<FeeRow>) {
		setRows((r) => (r ? { ...r, [type]: { ...r[type], ...patch } } : r));
	}
	function setRate(type: FeeType, idx: number, namekey: string) {
		setRows((r) => {
			if (!r) return r;
			const rates = r[type].rates.slice();
			rates[idx] = namekey;
			return { ...r, [type]: { ...r[type], rates } };
		});
	}
	function addRate(type: FeeType) {
		setRows((r) => {
			if (!r) return r;
			// Default the new row to the first rate not already applied to this fee.
			const used = new Set(r[type].rates);
			const next = taxRates.find((tr) => !used.has(tr.namekey));
			return { ...r, [type]: { ...r[type], rates: [...r[type].rates, next ? next.namekey : ''] } };
		});
	}
	function removeRate(type: FeeType, idx: number) {
		setRows((r) => (r ? { ...r, [type]: { ...r[type], rates: r[type].rates.filter((_, i) => i !== idx) } } : r));
	}

	async function save() {
		if (!client || !order || !rows || busy) return;
		setSaveErr('');
		setBusy(true);
		try {
			const payload = {} as Record<FeeType, { amount: number; tax_namekeys: string[]; code?: string }>;
			for (const type of FEE_TYPES) {
				const row = rows[type];
				// Drop blanks and de-duplicate rates before sending.
				const nks = [...new Set(row.rates.filter((nk) => nk))];
				payload[type] = { amount: Number(row.amount) || 0, tax_namekeys: nks };
				if (type === 'discount') payload[type].code = row.code;
			}
			const res = await client.saveOrderFees(orderId, payload);
			await cache.putOrderDetail(storeId, orderId, { ...order, fees: res.fees, totals: res.totals });
			nav(-1);
		} catch (e) {
			setSaveErr(tError(t, codeOf(e)));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen
			title={t('order.adjustFees')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={rows ? <button className="hk-appbar-act" disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</button> : undefined}
		>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : order && rows ? (
				<div className="hk-bento">
					{FEE_TYPES.map((type) => {
						const row = rows[type];
						const amount = Number(row.amount) || 0;
						const totalRate = row.rates.reduce((s, nk) => s + rateOf(nk), 0);
						const incl = amount * (1 + totalRate);
						return (
							<div key={type} className="hk-card hk-card--pad hk-form">
								<span className="hk-muted">{t(FEE_LABEL[type])}</span>
								<Field label={t('order.feeAmount')}>
									<input className="hk-input" type="number" inputMode="decimal" value={row.amount}
										onChange={(e) => update(type, { amount: e.target.value })} />
								</Field>
								<Field label={t('order.taxRates')}>
									{row.rates.length === 0 && <div className="hk-row-sub">{t('order.noTax')}</div>}
									{row.rates.map((nk, i) => {
										// Offer rates not used by the other rows of this fee (plus this row's own).
										const otherUsed = new Set(row.rates.filter((_, j) => j !== i));
										const opts = taxRates.filter((tr) => tr.namekey === nk || !otherUsed.has(tr.namekey));
										return (
											<div key={i} className="hk-row" style={{ gap: 'var(--hk-s2)', alignItems: 'center' }}>
												<select className="hk-select hk-row-grow" value={nk} onChange={(e) => setRate(type, i, e.target.value)}>
													{!nk && <option value="">{t('order.selectRate')}</option>}
													{opts.map((tr) => (
														<option key={tr.namekey} value={tr.namekey}>{tr.namekey} ({Math.round(tr.rate * 10000) / 100}%)</option>
													))}
												</select>
												<button type="button" className="hk-iconbtn" aria-label={t('common.delete')} onClick={() => removeRate(type, i)}><Icon name="close" size={18} /></button>
											</div>
										);
									})}
									{row.rates.length < taxRates.length && (
										<Button variant="ghost" style={{ marginTop: 'var(--hk-s2)' }} onClick={() => addRate(type)}>{t('order.addTaxRate')}</Button>
									)}
								</Field>
								{type === 'discount' && (
									<Field label={t('order.discountCode')}>
										<input className="hk-input" type="text" value={row.code} onChange={(e) => update(type, { code: e.target.value })} />
									</Field>
								)}
								<div className="hk-row">
									<div className="hk-row-grow"><span className="hk-row-sub">{t('order.inclTax')}</span></div>
									<Money value={incl} currency={order.currency_id} />
								</div>
							</div>
						);
					})}
					{saveErr && <div className="hk-error-note">{saveErr}</div>}
				</div>
			) : null}
		</Screen>
	);
}
