import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { usePaged } from '../app/use-paged';
import { useT, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { Discount, DiscountType } from '../core';
import { Screen, Search, Money, Spinner, NewButton, LoadMore, PublishToggle } from '../ui';
import { useDataChanged } from '../app/data-changed';
import { usePublish } from '../app/use-publish';

// Rows per request. The connector caps a page at 100.
const PAGE = 30;

export function Discounts() {
	const { client, active, cache } = useStores();
	const t = useT();
	const changed = useDataChanged();
	const nav = useNavigate();
	const [search, setSearch] = useState('');
	const [type, setType] = useState<DiscountType | ''>('');
	const storeId = active?.id ?? '';
	const filterKey = ordersFilterKey(type, search);

	const { items, total, loading, error, hasMore, loadingMore, moreError, loadMore } = usePaged<Discount>({
		enabled: !!client && !!active,
		read: () => cache.getDiscounts(storeId, filterKey),
		fetch: (start) => client!.getDiscounts({ search: search || undefined, type: type || undefined, limit: PAGE, start }),
		write: async (p) => { await cache.putDiscounts(storeId, filterKey, p); },
		deps: [storeId, search, type, changed.version('discounts')],
		debounceMs: search ? 300 : 0,
	});


	// A partial save: the connector keeps every column the payload does not mention.
	const publish = usePublish<Discount>({
		resetKey: filterKey,
		save: (d, published) => client!.updateDiscount(d.id, { published }),
	});

	function quotaLabel(d: Discount): string {
		if (d.quota > 0) return t('discount.usedOfQuota', { used: d.used_times, quota: d.quota });
		return t('discount.usedTimes', { count: d.used_times });
	}

	return (
		<Screen scrollResetKey={`${type}|${search}`} title={t('discounts.title')} right={<NewButton onClick={() => nav('/discounts/new')} />}>
			<Search value={search} onChange={setSearch} placeholder={t('discounts.search')} />
			<div className="hk-filter-bar">
				{([['', 'discounts.filterAll'], ['coupon', 'discounts.filterCoupons'], ['discount', 'discounts.filterAuto']] as const).map(([v, key]) => (
					<button key={v || 'all'} type="button" className={`hk-chip${type === v ? ' hk-on' : ''}`} onClick={() => setType(v)}>
						{t(key)}
					</button>
				))}
			</div>
			{publish.error && <div className="hk-error-note">{tError(t, publish.error)}</div>}
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
									{!publish.isPublished(d) && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('discount.unpublished')}</span>}
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
							<PublishToggle published={publish.isPublished(d)} busy={publish.busy[d.id]} onToggle={() => publish.toggle(d)} />
						</NavLink>
					))}
					<LoadMore shown={items.length} total={total} hasMore={hasMore} loading={loadingMore} error={moreError} onLoad={loadMore} />
				</div>
			)}
		</Screen>
	);
}
