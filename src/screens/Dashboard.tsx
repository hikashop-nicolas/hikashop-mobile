import { useEffect, useState } from 'react';
import { useStores } from '../app/store-context';
import type { DashboardStats } from '../core';
import { Screen, StatCard, Spinner } from '../ui';

const RANGES: [string, string][] = [['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']];

export function Dashboard() {
	const { client, active } = useStores();
	const [range, setRange] = useState('week');
	const [data, setData] = useState<DashboardStats | null>(null);
	const [err, setErr] = useState('');
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!client) return;
		let cancelled = false;
		setLoading(true);
		setErr('');
		client.getDashboard(range)
			.then((d) => { if (!cancelled) setData(d); })
			.catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load.'); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [client, range]);

	return (
		<Screen title={active?.name ?? 'Dashboard'}>
			<div className="hk-chiprow" style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap' }}>
				{RANGES.map(([k, l]) => (
					<button key={k} className={`hk-chip${range === k ? ' hk-on' : ''}`} onClick={() => setRange(k)}>{l}</button>
				))}
			</div>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : err ? (
				<div className="hk-error-note">{err}</div>
			) : data ? (
				<>
					<div className="hk-stats">
						<StatCard label="Revenue" value={data.totals.revenue.toFixed(2)} />
						<StatCard label="Orders" value={data.totals.orders} />
						<StatCard label="Avg. order" value={data.totals.average_order.toFixed(2)} />
						<StatCard label="Customers" value={data.totals.customers} />
					</div>
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">Top products</span>
						{data.top_products.length === 0 ? (
							<div className="hk-empty">No sales in this range.</div>
						) : (
							data.top_products.map((p, i) => (
								<div key={i} className="hk-row">
									<div className="hk-row-grow"><span className="hk-row-title">{p.name}</span></div>
									<span className="hk-money">{p.quantity} sold</span>
								</div>
							))
						)}
					</div>
				</>
			) : null}
		</Screen>
	);
}
