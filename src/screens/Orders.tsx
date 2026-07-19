import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useI18n, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { OrderSummary, Paginated } from '../core';
import { Screen, Search, StatusChip, Money, Spinner } from '../ui';
import { fmtDate } from '../app/utils';

const FILTERS: [string, string][] = [
	['', 'orders.filter.all'],
	['confirmed', 'orders.filter.confirmed'],
	['created', 'orders.filter.created'],
	['shipped', 'orders.filter.shipped'],
	['cancelled', 'orders.filter.cancelled'],
];

export function Orders() {
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
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
		<Screen title={t('orders.title')}>
			<Search value={search} onChange={setSearch} placeholder={t('orders.search')} />
			<div style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap' }}>
				{FILTERS.map(([f, labelKey]) => (
					<button key={f || 'all'} className={`hk-chip${status === f ? ' hk-on' : ''}`} onClick={() => setStatus(f)}>
						{t(labelKey)}
					</button>
				))}
			</div>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : items.length === 0 ? (
				<div className="hk-empty">{t('orders.none')}</div>
			) : (
				<div>
					{items.map((o) => (
						<Link key={o.id} to={`/orders/${o.id}`} className="hk-row">
							<div className="hk-avatar">{(o.customer.name || o.customer.email || '?').charAt(0).toUpperCase()}</div>
							<div className="hk-row-grow">
								<span className="hk-row-title">#{o.number} · {o.customer.name || o.customer.email || t('common.guest')}</span>
								<span className="hk-row-sub">{fmtDate(o.created, locale)}</span>
							</div>
							<div className="hk-row-rt"><StatusChip status={o.status} /><Money value={o.total} /></div>
						</Link>
					))}
					<div className="hk-muted" style={{ textAlign: 'center', padding: 'var(--hk-s2)' }}>{t('orders.countOf', { shown: items.length, total })}</div>
				</div>
			)}
		</Screen>
	);
}
