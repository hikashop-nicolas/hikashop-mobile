import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { OrderDetail, OrderFee } from '../core';
import { Screen, Spinner, Icon, Field, Money } from '../ui';

// The three editable order-level fees, in display order.
const FEE_TYPES = ['discount', 'shipping', 'payment'] as const;
type FeeType = typeof FEE_TYPES[number];
const FEE_LABEL: Record<FeeType, string> = { discount: 'order.discount', shipping: 'order.shipping', payment: 'order.paymentFee' };

// One fee's editable state: ex-tax amount, a single tax rate namekey (''=no tax), and the
// discount code. A single rate covers the usual case; multi-rate fees collapse to the first.
type FeeRow = { amount: string; rate: string; code: string; extraRates: string[] };

function toRow(fee: OrderFee): FeeRow {
	const nks = fee.tax_namekeys ?? [];
	return { amount: fee.amount ? String(fee.amount) : '', rate: nks[0] ?? '', code: fee.code ?? '', extraRates: nks.slice(1) };
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

	const rateOf = (namekey: string): number => order?.tax_rates.find((r) => r.namekey === namekey)?.rate ?? 0;

	function update(type: FeeType, patch: Partial<FeeRow>) {
		setRows((r) => (r ? { ...r, [type]: { ...r[type], ...patch } } : r));
	}

	async function save() {
		if (!client || !order || !rows || busy) return;
		setSaveErr('');
		setBusy(true);
		try {
			const payload = {} as Record<FeeType, { amount: number; tax_namekeys: string[]; code?: string }>;
			for (const type of FEE_TYPES) {
				const row = rows[type];
				const nks = row.rate ? [row.rate, ...row.extraRates] : [...row.extraRates];
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
						const incl = amount * (1 + rateOf(row.rate) + row.extraRates.reduce((s, nk) => s + rateOf(nk), 0));
						return (
							<div key={type} className="hk-card hk-card--pad hk-form">
								<span className="hk-muted">{t(FEE_LABEL[type])}</span>
								<Field label={t('order.feeAmount')}>
									<input className="hk-input" type="number" inputMode="decimal" value={row.amount}
										onChange={(e) => update(type, { amount: e.target.value })} />
								</Field>
								<Field label={t('order.taxRate')}>
									<select className="hk-select" value={row.rate} onChange={(e) => update(type, { rate: e.target.value })}>
										<option value="">{t('order.noTax')}</option>
										{order.tax_rates.map((r) => (
											<option key={r.namekey} value={r.namekey}>{r.namekey} ({Math.round(r.rate * 10000) / 100}%)</option>
										))}
									</select>
								</Field>
								{row.extraRates.length > 0 && (
									<div className="hk-row-sub">{t('order.multiRateKept', { rates: row.extraRates.join(', ') })}</div>
								)}
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
