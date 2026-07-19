import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { ordersFilterKey } from '../core';
import type { OrderSummary, Paginated } from '../core';
import { Screen, Search, StatusChip, Money, Spinner } from '../ui';
import { fmtDate } from '../app/utils';

const FILTERS = ['', 'confirmed', 'created', 'shipped', 'cancelled'];

export function Orders() {
	const { client, active, cache } = useStores();
	const [status, setStatus] = useState('');
	const [search, setSearch] = useState('');
	const storeId = active?.id ?? '';
	const filterKey = ordersFilterKey(status, search);

	const { data, loading, error } = useCached<Paginated<OrderSummary>>({
		enabled: !!client && !!active,
		read: () => cache.getOrders(storeId, filterKey),
		fetch: () => client!.getOrders({ status: status || undefined, search: search || undefined, limit: 30 }),
		write: async (p) => { await cache.putOrders(storeId, filterKey, p); },
		deps: [storeId, status, search],
		debounceMs: search ? 300 : 0,
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	return (
		<Screen title="Orders">
			<Search value={search} onChange={setSearch} placeholder="Search order # or customer" />
			<div style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap' }}>
				{FILTERS.map((f) => (
					<button key={f || 'all'} className={`hk-chip${status === f ? ' hk-on' : ''}`} onClick={() => setStatus(f)}>
						{f ? f.charAt(0).toUpperCase() + f.slice(1) : 'All'}
					</button>
				))}
			</div>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{error}</div>
			) : items.length === 0 ? (
				<div className="hk-empty">No orders found.</div>
			) : (
				<div>
					{items.map((o) => (
						<Link key={o.id} to={`/orders/${o.id}`} className="hk-row">
							<div className="hk-avatar">{(o.customer.name || o.customer.email || '?').charAt(0).toUpperCase()}</div>
							<div className="hk-row-grow">
								<span className="hk-row-title">#{o.number} · {o.customer.name || o.customer.email || 'Guest'}</span>
								<span className="hk-row-sub">{fmtDate(o.created)}</span>
							</div>
							<div className="hk-row-rt"><StatusChip status={o.status} /><Money value={o.total} /></div>
						</Link>
					))}
					<div className="hk-muted" style={{ textAlign: 'center', padding: 'var(--hk-s2)' }}>{items.length} of {total}</div>
				</div>
			)}
		</Screen>
	);
}
