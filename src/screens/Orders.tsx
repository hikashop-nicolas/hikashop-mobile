import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useI18n, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { OrderSummary, Paginated } from '../core';
import { Screen, Search, StatusChip, Money, Spinner, Icon } from '../ui';
import { fmtDate } from '../app/utils';
import { NewOrderModal } from './NewOrderModal';
import { useStatuses } from '../app/statuses';

export function Orders() {
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
	const { statuses, statusLabel } = useStatuses();
	const nav = useNavigate();
	const [status, setStatus] = useState('');
	const [search, setSearch] = useState('');
	const [creating, setCreating] = useState(false);
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
		<Screen
			title={t('orders.title')}
			right={<button className="hk-iconbtn" aria-label={t('orders.newOrder')} onClick={() => setCreating(true)}><Icon name="plus" size={24} /></button>}
		>
			<Search value={search} onChange={setSearch} placeholder={t('orders.search')} />
			<div style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap' }}>
				<button key="all" className={`hk-chip${status === '' ? ' hk-on' : ''}`} onClick={() => setStatus('')}>
					{t('orders.filter.all')}
				</button>
				{statuses.map((s) => (
					<button key={s.namekey} className={`hk-chip${status === s.namekey ? ' hk-on' : ''}`} onClick={() => setStatus(s.namekey)}>
						{statusLabel(s.namekey)}
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
							<div className="hk-row-rt"><StatusChip status={o.status} /><Money value={o.total} currency={o.currency_id} /></div>
						</Link>
					))}
					<div className="hk-muted" style={{ textAlign: 'center', padding: 'var(--hk-s2)' }}>{t('orders.countOf', { shown: items.length, total })}</div>
				</div>
			)}
			{creating && (
				<NewOrderModal
					onClose={() => setCreating(false)}
					onCreated={(orderId) => { setCreating(false); nav(`/orders/${orderId}`); }}
				/>
			)}
		</Screen>
	);
}
