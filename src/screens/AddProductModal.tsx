import { useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { OrderProductPrecompute, OrderItem, OrderDetail, TaxRate } from '../core';
import { Modal, Field, Money, Button, Icon } from '../ui';
import { SearchPicker } from './SearchPicker';

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

// Add a product line to an order: pick a product (search), pre-fill its price/tax in the
// order's context, let the operator edit amount / quantity / tax rates, then add.
export function AddProductModal({ orderId, currencyId, taxRates, onClose, onAdded }: {
	orderId: number;
	currencyId: number;
	taxRates: TaxRate[];
	onClose: () => void;
	onAdded: (items: OrderItem[], totals: OrderDetail['totals']) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [pre, setPre] = useState<OrderProductPrecompute | null>(null);
	const [qty, setQty] = useState('1');
	const [price, setPrice] = useState('');
	const [rates, setRates] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	const rateOf = (nk: string) => taxRates.find((r) => r.namekey === nk)?.rate ?? 0;

	async function pick(item: { id: number }) {
		setErr('');
		try {
			const p = await client!.precomputeOrderProduct(orderId, item.id, 1);
			setPre(p);
			setQty(String(p.quantity || 1));
			setPrice(String(p.price));
			setRates(p.tax_namekeys);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
		}
	}

	async function add() {
		if (!client || !pre || busy) return;
		setErr('');
		setBusy(true);
		try {
			const res = await client.addOrderProduct(orderId, {
				product_id: pre.product_id,
				quantity: Number(qty) || 1,
				price: Number(price) || 0,
				tax_namekeys: [...new Set(rates.filter((nk) => nk))],
			});
			onAdded(res.items, res.totals);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	if (!pre) {
		return (
			<SearchPicker
				title={t('order.addProduct')}
				placeholder={t('products.search')}
				minChars={1}
				search={async (q) => {
					const r = await client!.getProducts({ search: q, limit: 20 });
					return r.items.map((p) => ({ id: p.id, label: p.name, sub: p.code }));
				}}
				onClose={onClose}
				onPick={pick}
			/>
		);
	}

	const amount = Number(price) || 0;
	const quantity = Number(qty) || 1;
	const totalRate = rates.reduce((s, nk) => s + rateOf(nk), 0);
	const lineTotal = amount * (1 + totalRate) * quantity;

	return (
		<Modal title={pre.name} onClose={onClose}>
			<div className="hk-form">
				<Field label={t('order.feeAmount')}>
					<input className="hk-input" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
				</Field>
				<Field label={t('product.minQuantity')}>
					<input className="hk-input" type="number" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
				</Field>
				<Field label={t('order.taxRates')}>
					{rates.length === 0 && <div className="hk-row-sub">{t('order.noTax')}</div>}
					{rates.map((nk, i) => {
						const otherUsed = new Set(rates.filter((_, j) => j !== i));
						const opts = taxRates.filter((tr) => tr.namekey === nk || !otherUsed.has(tr.namekey));
						return (
							<div key={i} className="hk-row" style={{ gap: 'var(--hk-s2)', alignItems: 'center' }}>
								<select className="hk-select hk-row-grow" value={nk} onChange={(e) => setRates((r) => r.map((v, j) => (j === i ? e.target.value : v)))}>
									{!nk && <option value="">{t('order.selectRate')}</option>}
									{opts.map((tr) => <option key={tr.namekey} value={tr.namekey}>{tr.namekey} ({Math.round(tr.rate * 10000) / 100}%)</option>)}
								</select>
								<button type="button" className="hk-iconbtn" aria-label={t('common.delete')} onClick={() => setRates((r) => r.filter((_, j) => j !== i))}><Icon name="close" size={18} /></button>
							</div>
						);
					})}
					{rates.length < taxRates.length && (
						<Button size="sm" style={{ marginTop: 'var(--hk-s2)', alignSelf: 'flex-start' }} onClick={() => setRates((r) => {
							const used = new Set(r);
							const next = taxRates.find((tr) => !used.has(tr.namekey));
							return [...r, next ? next.namekey : ''];
						})}>{t('order.addTaxRate')}</Button>
					)}
				</Field>
				<div className="hk-row">
					<div className="hk-row-grow"><span className="hk-row-sub">{t('order.inclTax')}</span></div>
					<Money value={lineTotal} currency={currencyId} />
				</div>
				{err && <div className="hk-error-note">{err}</div>}
				<Button variant="pri" block disabled={busy} onClick={() => void add()}>{busy ? t('product.saving') : t('order.addProduct')}</Button>
			</div>
		</Modal>
	);
}
