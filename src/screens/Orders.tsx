import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStores } from '../app/store-context';
import type { OrderSummary } from '../core';
import { Screen, Search, StatusChip, Money, Spinner } from '../ui';
import { fmtDate } from '../app/utils';

const FILTERS = ['', 'confirmed', 'created', 'shipped', 'cancelled'];

export function Orders() {
	const { client } = useStores();
	const [status, setStatus] = useState('');
	const [search, setSearch] = useState('');
	const [items, setItems] = useState<OrderSummary[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [err, setErr] = useState('');

	useEffect(() => {
		if (!client) return;
		let cancelled = false;
		setLoading(true);
		setErr('');
		const timer = setTimeout(() => {
			client.getOrders({ status: status || undefined, search: search || undefined, limit: 30 })
				.then((p) => { if (!cancelled) { setItems(p.items); setTotal(p.total); } })
				.catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load.'); })
				.finally(() => { if (!cancelled) setLoading(false); });
		}, search ? 300 : 0);
		return () => { cancelled = true; clearTimeout(timer); };
	}, [client, status, search]);

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
			) : err ? (
				<div className="hk-error-note">{err}</div>
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
