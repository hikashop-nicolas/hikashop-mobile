import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useI18n, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { CustomerSummary, Paginated } from '../core';
import { Screen, Search, Spinner, NewButton } from '../ui';
import { fmtDate } from '../app/utils';
import { NewCustomerModal } from './NewCustomerModal';

export function Customers() {
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
	const nav = useNavigate();
	const [search, setSearch] = useState('');
	const [creating, setCreating] = useState(false);
	const storeId = active?.id ?? '';
	const filterKey = ordersFilterKey('', search);

	const { data, loading, error } = useCached<Paginated<CustomerSummary>>({
		enabled: !!client && !!active,
		read: () => cache.getCustomers(storeId, filterKey),
		fetch: () => client!.getCustomers({ search: search || undefined, limit: 30 }),
		write: async (p) => { await cache.putCustomers(storeId, filterKey, p); },
		deps: [storeId, search],
		debounceMs: search ? 300 : 0,
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

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
					<div className="hk-muted" style={{ textAlign: 'center', padding: 'var(--hk-s2)' }}>{t('customers.countOf', { shown: items.length, total })}</div>
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
