import { useState } from 'react';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { DashboardStats } from '../core';
import { Screen, StatCard, Spinner, Money } from '../ui';

const RANGES: [string, string][] = [
	['today', 'dashboard.range.today'],
	['week', 'dashboard.range.week'],
	['month', 'dashboard.range.month'],
	['year', 'dashboard.range.year'],
];

export function Dashboard() {
	const { client, active, cache } = useStores();
	const t = useT();
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
		<Screen title={active?.name ?? t('tabs.dashboard')}>
			<div className="hk-chiprow" style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap' }}>
				{RANGES.map(([k, labelKey]) => (
					<button key={k} className={`hk-chip${range === k ? ' hk-on' : ''}`} onClick={() => setRange(k)}>{t(labelKey)}</button>
				))}
			</div>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : data ? (
				<>
					<div className="hk-stats">
						<StatCard label={t('dashboard.revenue')} value={<Money value={data.totals.revenue} currency={data.currency_id} />} />
						<StatCard label={t('dashboard.orders')} value={data.totals.orders} />
						<StatCard label={t('dashboard.avgOrder')} value={<Money value={data.totals.average_order} currency={data.currency_id} />} />
						<StatCard label={t('dashboard.customers')} value={data.totals.customers} />
					</div>
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('dashboard.topProducts')}</span>
						{data.top_products.length === 0 ? (
							<div className="hk-empty">{t('dashboard.noSales')}</div>
						) : (
							data.top_products.map((p, i) => (
								<div key={i} className="hk-row">
									<div className="hk-row-grow"><span className="hk-row-title">{p.name}</span></div>
									<span className="hk-money">{t('dashboard.sold', { count: p.quantity })}</span>
								</div>
							))
						)}
					</div>
				</>
			) : null}
		</Screen>
	);
}
