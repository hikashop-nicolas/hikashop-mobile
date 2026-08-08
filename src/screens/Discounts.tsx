import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { Discount, DiscountType, Paginated } from '../core';
import { Screen, Search, Money, Spinner, NewButton } from '../ui';

export function Discounts() {
	const { client, active, cache } = useStores();
	const t = useT();
	const nav = useNavigate();
	const [search, setSearch] = useState('');
	const [type, setType] = useState<DiscountType | ''>('');
	const storeId = active?.id ?? '';
	const filterKey = ordersFilterKey(type, search);

	const { data, loading, error } = useCached<Paginated<Discount>>({
		enabled: !!client && !!active,
		read: () => cache.getDiscounts(storeId, filterKey),
		fetch: () => client!.getDiscounts({ search: search || undefined, type: type || undefined, limit: 30 }),
		write: async (p) => { await cache.putDiscounts(storeId, filterKey, p); },
		deps: [storeId, search, type],
		debounceMs: search ? 300 : 0,
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	function quotaLabel(d: Discount): string {
		if (d.quota > 0) return t('discount.usedOfQuota', { used: d.used_times, quota: d.quota });
		return t('discount.usedTimes', { count: d.used_times });
	}

	return (
		<Screen title={t('discounts.title')} right={<NewButton onClick={() => nav('/discounts/new')} />}>
			<Search value={search} onChange={setSearch} placeholder={t('discounts.search')} />
			<div className="hk-filter-bar">
				{([['', 'discounts.filterAll'], ['coupon', 'discounts.filterCoupons'], ['discount', 'discounts.filterAuto']] as const).map(([v, key]) => (
					<button key={v || 'all'} type="button" className={`hk-chip${type === v ? ' hk-on' : ''}`} onClick={() => setType(v)}>
						{t(key)}
					</button>
				))}
			</div>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : items.length === 0 ? (
				<div className="hk-empty">{t('discounts.none')}</div>
			) : (
				<div>
					{items.map((d) => (
						<NavLink key={d.id} to={`/discounts/${d.id}/edit`} className={({ isActive }) => `hk-row${isActive ? ' hk-row--on' : ''}`}>
							<div className="hk-row-grow">
								<span className="hk-row-title">
									{d.type === 'coupon' ? d.code : t('discount.typeAuto')}
									{!d.published && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('discount.unpublished')}</span>}
								</span>
								<span className="hk-row-sub">
									{d.type === 'coupon' ? t('discount.typeCoupon') : t('discount.autoApplied')} · {quotaLabel(d)}
								</span>
							</div>
							<div className="hk-row-rt">
								<span className="hk-row-title">
									{d.kind === 'percent' ? `${d.value}%` : <Money value={d.value} currency={d.currency_id} />}
								</span>
							</div>
						</NavLink>
					))}
					<div className="hk-muted" style={{ textAlign: 'center', padding: 'var(--hk-s2)' }}>{t('discounts.countOf', { shown: items.length, total })}</div>
				</div>
			)}
		</Screen>
	);
}
