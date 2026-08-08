import { useEffect, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { Coupon, OrderFees, OrderDetail } from '../core';
import { Modal, Field, Button, Money, Spinner, Icon } from '../ui';

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}
function msgOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string') ? (e as { message: string }).message : '';
}

// Browse the shop's coupons and apply one to an order (or remove the current one). The store
// validates the coupon and computes the discount; a rejection is shown with its reason.
export function ApplyCouponModal({ orderId, currentCode, currencyId, onClose, onChanged }: {
	orderId: number;
	currentCode: string;
	currencyId: number;
	onClose: () => void;
	onChanged: (fees: OrderFees, totals: OrderDetail['totals']) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [coupons, setCoupons] = useState<Coupon[] | null>(null);
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	useEffect(() => {
		let alive = true;
		void (async () => {
			try { const c = await client!.getCoupons(); if (alive) setCoupons(c); }
			catch { if (alive) setCoupons([]); }
		})();
		return () => { alive = false; };
	}, [client]);

	async function apply(c: string) {
		const value = c.trim();
		if (!client || busy || !value) return;
		setErr('');
		setBusy(true);
		try {
			const res = await client.applyOrderCoupon(orderId, value);
			onChanged(res.fees, res.totals);
		} catch (e) {
			// The store returns HikaShop's own reason (expired, quota, wrong zone...) as the message.
			setErr(msgOf(e) || tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	async function remove() {
		if (!client || busy) return;
		setErr('');
		setBusy(true);
		try {
			const res = await client.removeOrderCoupon(orderId);
			onChanged(res.fees, res.totals);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	return (
		<Modal title={t('order.coupon')} onClose={onClose}>
			<div className="hk-form">
				{currentCode && (
					<div className="hk-row" style={{ alignItems: 'center' }}>
						<div className="hk-row-grow"><span className="hk-row-title">{currentCode}</span><span className="hk-row-sub">{t('order.couponApplied')}</span></div>
						<Button variant="danger" disabled={busy} onClick={() => void remove()}><Icon name="trash" size={16} /> {t('common.delete')}</Button>
					</div>
				)}
				<Field label={t('order.couponCode')}>
					<div className="hk-row" style={{ gap: 'var(--hk-s2)', alignItems: 'center' }}>
						<input className="hk-input hk-row-grow" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('order.couponCode')} />
						<Button variant="pri" disabled={busy || !code.trim()} onClick={() => void apply(code)}><Icon name="check" size={16} /> {busy ? t('product.saving') : t('order.applyCoupon')}</Button>
					</div>
				</Field>
				{err && <div className="hk-error-note">{err}</div>}
				<span className="hk-muted">{t('order.availableCoupons')}</span>
				{coupons === null ? (
					<div className="hk-center-col"><Spinner /></div>
				) : coupons.length === 0 ? (
					<div className="hk-empty">{t('order.noCoupons')}</div>
				) : (
					<div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
						{coupons.map((c) => (
							<button key={c.id} type="button" className="hk-row" disabled={busy}
								onClick={() => void apply(c.code)}
								style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--hk-line)', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
								<span className="hk-row-title hk-row-grow">{c.code}</span>
								<span className="hk-row-title" style={{ fontVariantNumeric: 'tabular-nums' }}>
									{c.percent_amount > 0 ? `${Math.round(c.percent_amount * 100) / 100}%` : <Money value={c.flat_amount} currency={c.currency_id || currencyId} />}
								</span>
							</button>
						))}
					</div>
				)}
			</div>
		</Modal>
	);
}
