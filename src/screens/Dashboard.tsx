import { useState } from 'react';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import type { DashboardStats } from '../core';
import { Screen, StatCard, Spinner } from '../ui';

const RANGES: [string, string][] = [['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']];

export function Dashboard() {
	const { client, active, cache } = useStores();
	const [range, setRange] = useState('week');
	const storeId = active?.id ?? '';

	const { data, loading, error } = useCached<DashboardStats>({
		enabled: !!client && !!active,
		read: () => cache.getDashboard(storeId, range),
		fetch: () => client!.getDashboard(range),
		write: async (d) => { await cache.putDashboard(storeId, range, d); },
		deps: [storeId, range],
	});

	return (
		<Screen title={active?.name ?? 'Dashboard'}>
			<div className="hk-chiprow" style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap' }}>
				{RANGES.map(([k, l]) => (
					<button key={k} className={`hk-chip${range === k ? ' hk-on' : ''}`} onClick={() => setRange(k)}>{l}</button>
				))}
			</div>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{error}</div>
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
