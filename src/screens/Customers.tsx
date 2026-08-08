import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { usePaged } from '../app/use-paged';
import { useI18n, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { CustomerSummary } from '../core';
import { Screen, Search, Spinner, NewButton, LoadMore } from '../ui';
import { fmtDate } from '../app/utils';
import { NewCustomerModal } from './NewCustomerModal';

// Rows per request. The connector caps a page at 100.
const PAGE = 30;

export function Customers() {
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
	const nav = useNavigate();
	const [search, setSearch] = useState('');
	const [creating, setCreating] = useState(false);
	const storeId = active?.id ?? '';
	const filterKey = ordersFilterKey('', search);

	const { items, total, loading, error, hasMore, loadingMore, moreError, loadMore } = usePaged<CustomerSummary>({
		enabled: !!client && !!active,
		read: () => cache.getCustomers(storeId, filterKey),
		fetch: (start) => client!.getCustomers({ search: search || undefined, limit: PAGE, start }),
		write: async (p) => { await cache.putCustomers(storeId, filterKey, p); },
		deps: [storeId, search],
		debounceMs: search ? 300 : 0,
	});


	return (
		<Screen title={t('customers.title')} right={<NewButton onClick={() => setCreating(true)} />}>
			<Search value={search} onChange={setSearch} placeholder={t('customers.search')} />
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : items.length === 0 ? (
				<div className="hk-empty">{t('customers.none')}</div>
			) : (
				<div>
					{items.map((c) => (
						<NavLink key={c.id} to={`/customers/${c.id}`} className={({ isActive }) => `hk-row${isActive ? ' hk-row--on' : ''}`}>
							<div className="hk-avatar">{(c.name || c.email || '?').charAt(0).toUpperCase()}</div>
							<div className="hk-row-grow">
								<span className="hk-row-title">
									{c.name || c.email || t('common.guest')}
									{c.type === 'guest' && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('customers.guest')}</span>}
								</span>
								<span className="hk-row-sub">{c.name ? c.email : fmtDate(c.created, locale)}</span>
							</div>
							<div className="hk-row-rt">
								<span className="hk-muted">{t('customers.orderCount', { count: c.order_count })}</span>
							</div>
						</NavLink>
					))}
					<LoadMore shown={items.length} total={total} hasMore={hasMore} loading={loadingMore} error={moreError} onLoad={loadMore} />
				</div>
			)}
			{creating && (
				<NewCustomerModal
					onClose={() => setCreating(false)}
					onCreated={(id) => { setCreating(false); nav(`/customers/${id}`); }}
				/>
			)}
		</Screen>
	);
}
