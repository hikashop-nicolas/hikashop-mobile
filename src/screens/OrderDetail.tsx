import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useI18n, tError } from '../i18n';
import type { OrderDetail as OrderDetailType } from '../core';
import { Screen, StatusChip, Money, Spinner, Icon } from '../ui';
import { fmtDate } from '../app/utils';

// Standard HikaShop statuses offered as quick actions; the store validates the value.
const STATUSES = ['created', 'confirmed', 'shipped', 'cancelled', 'refunded'];

export function OrderDetail() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
	const storeId = active?.id ?? '';
	const orderId = Number(id);

	const { data: fetched, loading, error } = useCached<OrderDetailType>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getOrderDetail(storeId, orderId),
		fetch: () => client!.getOrder(orderId),
		write: async (o) => { await cache.putOrderDetail(storeId, orderId, o); },
		deps: [storeId, orderId],
	});

	// Local copy so a status change reflects instantly without a full reload.
	const [order, setOrder] = useState<OrderDetailType | null>(null);
	useEffect(() => { if (fetched) setOrder(fetched); }, [fetched]);

	const [notify, setNotify] = useState(false);
	const [busy, setBusy] = useState('');
	const [updateErr, setUpdateErr] = useState('');

	async function changeStatus(status: string) {
		if (!client || !order || busy || status === order.status) return;
		setUpdateErr('');
		setBusy(status);
		try {
			await client.setOrderStatus(orderId, status, { notify });
			const now = Math.floor(Date.now() / 1000);
			const next: OrderDetailType = { ...order, status, history: [{ status, created: now }, ...order.history] };
			setOrder(next);
			await cache.putOrderDetail(storeId, orderId, next);
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setUpdateErr(tError(t, code));
		} finally {
			setBusy('');
		}
	}

	return (
		<Screen
			title={order ? t('order.title', { number: order.number }) : t('order.titleFallback')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={order ? <StatusChip status={order.status} /> : undefined}
		>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : order ? (
				<>
					<div className="hk-card hk-card--pad">
						<div className="hk-row-title">{order.customer.name || t('common.guest')}</div>
						<div className="hk-row-sub">{order.customer.email}</div>
					</div>
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('order.items')}</span>
						{order.items.map((it, i) => (
							<div key={i} className="hk-row">
								<div className="hk-row-grow">
									<span className="hk-row-title">{it.name}</span>
									<span className="hk-row-sub">{t('order.qty', { count: it.quantity })}{it.code ? ` · ${it.code}` : ''}</span>
								</div>
								<Money value={it.price} />
							</div>
						))}
						<div className="hk-row">
							<div className="hk-row-grow"><span className="hk-row-sub">{t('order.shipping')}</span></div>
							<Money value={order.totals.shipping} />
						</div>
						<div className="hk-row">
							<div className="hk-row-grow"><span className="hk-row-title">{t('order.total')}</span></div>
							<span className="hk-row-title"><Money value={order.totals.total} /></span>
						</div>
					</div>

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('order.changeStatus')}</span>
						<div className="hk-chiprow" style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap', marginTop: 'var(--hk-s2)' }}>
							{STATUSES.map((s) => (
								<button
									key={s}
									className={`hk-chip${s === order.status ? ' hk-on' : ''}`}
									disabled={!!busy}
									onClick={() => void changeStatus(s)}
								>
									{busy === s ? t('order.updating') : t(`status.${s}`)}
								</button>
							))}
						</div>
						<label className="hk-check">
							<input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={!!busy} />
							<span>{t('order.notifyCustomer')}</span>
						</label>
						{updateErr && <div className="hk-error-note" style={{ marginTop: 'var(--hk-s3)' }}>{updateErr}</div>}
					</div>

					{order.billing_address && (
						<div className="hk-card hk-card--pad">
							<span className="hk-muted">{t('order.billing')}</span>
							<div>{order.billing_address.name}</div>
							<div className="hk-row-sub">
								{order.billing_address.street}, {order.billing_address.post_code} {order.billing_address.city}
							</div>
						</div>
					)}
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('order.history')}</span>
						{order.history.map((h, i) => (
							<div key={i} className="hk-row">
								<div className="hk-row-grow"><StatusChip status={h.status} /></div>
								<span className="hk-row-sub">{fmtDate(h.created, locale)}</span>
							</div>
						))}
					</div>
				</>
			) : null}
		</Screen>
	);
}
