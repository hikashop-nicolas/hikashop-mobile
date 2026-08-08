import { useState } from 'react';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError, useI18n } from '../i18n';
import type { DashboardStats } from '../core';
import { Screen, StatCard, Spinner, Money, AreaChart, BarList } from '../ui';

// The series comes back as YYYY-MM-DD; the axis only has room for day and month.
function shortDate(iso: string, locale: string): string {
	const d = new Date(`${iso}T00:00:00`);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
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
					<div className="hk-stats">
						<StatCard label={t('dashboard.revenue')} value={<Money value={data.totals.revenue} currency={data.currency_id} />} />
						<StatCard label={t('dashboard.orders')} value={data.totals.orders} />
						<StatCard label={t('dashboard.avgOrder')} value={<Money value={data.totals.average_order} currency={data.currency_id} />} />
						<StatCard label={t('dashboard.customers')} value={data.totals.customers} />
					</div>
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('dashboard.revenueOverTime')}</span>
						<AreaChart
							points={data.revenue_series.map((s) => ({ label: shortDate(s.date, locale), value: s.revenue }))}
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
