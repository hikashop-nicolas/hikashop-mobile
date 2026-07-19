import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useI18n, tError } from '../i18n';
import type { OrderDetail as OrderDetailType } from '../core';
import { Screen, StatusChip, Money, Spinner, Icon } from '../ui';
import { fmtDate } from '../app/utils';

export function OrderDetail() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
	const storeId = active?.id ?? '';
	const orderId = Number(id);

	const { data: order, loading, error } = useCached<OrderDetailType>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getOrderDetail(storeId, orderId),
		fetch: () => client!.getOrder(orderId),
		write: async (o) => { await cache.putOrderDetail(storeId, orderId, o); },
		deps: [storeId, orderId],
	});

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
