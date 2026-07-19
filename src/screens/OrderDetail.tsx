import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import type { OrderDetail as OrderDetailType } from '../core';
import { Screen, StatusChip, Money, Spinner } from '../ui';
import { fmtDate } from '../app/utils';

export function OrderDetail() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
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
			title={order ? `Order #${order.number}` : 'Order'}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label="Back">‹</button>}
			right={order ? <StatusChip status={order.status} /> : undefined}
		>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{error}</div>
			) : order ? (
				<>
					<div className="hk-card hk-card--pad">
						<div className="hk-row-title">{order.customer.name || 'Guest'}</div>
						<div className="hk-row-sub">{order.customer.email}</div>
					</div>
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">Items</span>
						{order.items.map((it, i) => (
							<div key={i} className="hk-row">
								<div className="hk-row-grow">
									<span className="hk-row-title">{it.name}</span>
									<span className="hk-row-sub">Qty {it.quantity}{it.code ? ` · ${it.code}` : ''}</span>
								</div>
								<Money value={it.price} />
							</div>
						))}
						<div className="hk-row">
							<div className="hk-row-grow"><span className="hk-row-sub">Shipping</span></div>
							<Money value={order.totals.shipping} />
						</div>
						<div className="hk-row">
							<div className="hk-row-grow"><span className="hk-row-title">Total</span></div>
							<span className="hk-row-title"><Money value={order.totals.total} /></span>
						</div>
					</div>
					{order.billing_address && (
						<div className="hk-card hk-card--pad">
							<span className="hk-muted">Billing address</span>
							<div>{order.billing_address.name}</div>
							<div className="hk-row-sub">
								{order.billing_address.street}, {order.billing_address.post_code} {order.billing_address.city}
							</div>
						</div>
					)}
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">History</span>
						{order.history.map((h, i) => (
							<div key={i} className="hk-row">
								<div className="hk-row-grow"><StatusChip status={h.status} /></div>
								<span className="hk-row-sub">{fmtDate(h.created)}</span>
							</div>
						))}
					</div>
				</>
			) : null}
		</Screen>
	);
}
