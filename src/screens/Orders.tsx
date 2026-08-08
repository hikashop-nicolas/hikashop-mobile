import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { usePaged } from '../app/use-paged';
import { useI18n, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { OrderSummary } from '../core';
import { Screen, Search, StatusChip, Money, Spinner, NewButton, LoadMore } from '../ui';
import { fmtDate } from '../app/utils';
import { NewOrderModal } from './NewOrderModal';
import { useStatuses } from '../app/statuses';
import { ListingFields } from './ListingFields';

// Rows per request. The connector caps a page at 100.
const PAGE = 30;

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

	const { items, total, fields, loading, error, hasMore, loadingMore, moreError, loadMore } = usePaged<OrderSummary>({
		enabled: !!client && !!active,
		read: () => cache.getOrders(storeId, filterKey),
		fetch: (start) => client!.getOrders({ status: status || undefined, search: search || undefined, limit: PAGE, start }),
		write: async (p) => { await cache.putOrders(storeId, filterKey, p); },
		deps: [storeId, status, search],
		debounceMs: search ? 300 : 0,
	});


	return (
		<Screen
			scrollResetKey={`${status}|${search}`}
			title={t('orders.title')}
			right={<NewButton onClick={() => setCreating(true)} />}
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
						<NavLink key={o.id} to={`/orders/${o.id}`} className={({ isActive }) => `hk-row${isActive ? ' hk-row--on' : ''}`}>
							<div className="hk-avatar">{(o.customer.name || o.customer.email || '?').charAt(0).toUpperCase()}</div>
							<div className="hk-row-grow">
								<span className="hk-row-title">#{o.number} · {o.customer.name || o.customer.email || t('common.guest')}</span>
								<span className="hk-row-sub">{fmtDate(o.created, locale)}</span>
								<ListingFields fields={fields} values={o.custom_fields} />
							</div>
							<div className="hk-row-rt"><StatusChip status={o.status} /><Money value={o.total} currency={o.currency_id} /></div>
						</NavLink>
					))}
					<LoadMore shown={items.length} total={total} hasMore={hasMore} loading={loadingMore} error={moreError} onLoad={loadMore} />
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
