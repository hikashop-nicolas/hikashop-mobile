import { useState } from 'react';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError, useI18n } from '../i18n';
import type { DashboardStats } from '../core';
import { Screen, StatCard, Spinner, Money, AreaChart, BarList } from '../ui';

// A point is labelled by what it covers: an hour of today, a day, or the week it starts. The
// axis only has room for the short form of any of them.
function pointLabel(value: string, granularity: 'hour' | 'day' | 'week', locale: string): string {
	const tag = locale === 'fr' ? 'fr-FR' : 'en-GB';
	// 'YYYY-MM-DD HH:00' for an hour, 'YYYY-MM-DD' otherwise. Both parse with a T separator.
	const d = new Date(value.includes(' ') ? value.replace(' ', 'T') : `${value}T00:00:00`);
	if (Number.isNaN(d.getTime())) return value;
	if (granularity === 'hour') return d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' });
	return d.toLocaleDateString(tag, { day: 'numeric', month: 'short' });
}

// A figure and its counterpart from the period before, when the shop sent one.
function compareOf(data: DashboardStats, key: 'revenue' | 'orders' | 'average_order' | 'customers') {
	if (!data.previous) return undefined;
	return { current: data.totals[key], previous: data.previous[key] };
}

const RANGES: [string, string][] = [
	['today', 'dashboard.range.today'],
	['week', 'dashboard.range.week'],
	['month', 'dashboard.range.month'],
	['year', 'dashboard.range.year'],
];

export function Dashboard() {
	const { client, active, cache } = useStores();
	const t = useT();
	const { locale } = useI18n();
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
					{/* Each figure is shown against the same length of time immediately before it. */}
					<div className="hk-stats">
						<StatCard
							label={t('dashboard.revenue')}
							value={<Money value={data.totals.revenue} currency={data.currency_id} />}
							compare={compareOf(data, 'revenue')}
							newLabel={t('dashboard.deltaNew')} />
						<StatCard
							label={t('dashboard.orders')}
							value={data.totals.orders}
							compare={compareOf(data, 'orders')}
							newLabel={t('dashboard.deltaNew')} />
						<StatCard
							label={t('dashboard.avgOrder')}
							value={<Money value={data.totals.average_order} currency={data.currency_id} />}
							compare={compareOf(data, 'average_order')}
							newLabel={t('dashboard.deltaNew')} />
						<StatCard
							label={t('dashboard.customers')}
							value={data.totals.customers}
							compare={compareOf(data, 'customers')}
							newLabel={t('dashboard.deltaNew')} />
					</div>
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('dashboard.revenueOverTime')}</span>
						<AreaChart
							points={data.revenue_series.map((s) => ({ label: pointLabel(s.date, data.series_granularity ?? 'day', locale), value: s.revenue }))}
							peak={data.revenue_series.length > 0 ? (
								<>
									{t('dashboard.peak')}{' '}
									<Money value={Math.max(...data.revenue_series.map((s) => s.revenue))} currency={data.currency_id} />
								</>
							) : undefined}
							emptyLabel={t('dashboard.noRevenue')}
						/>
					</div>
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('dashboard.topProducts')}</span>
						<BarList
							items={data.top_products.map((p) => ({
								label: p.name,
								value: p.quantity,
								display: t('dashboard.sold', { count: p.quantity }),
							}))}
							emptyLabel={t('dashboard.noSales')}
						/>
					</div>
				</>
			) : null}
		</Screen>
	);
}
