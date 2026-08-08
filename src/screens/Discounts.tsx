import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { Discount, Paginated } from '../core';
import { Screen, Search, Money, Spinner, NewButton } from '../ui';

export function Discounts() {
	const { client, active, cache } = useStores();
	const t = useT();
	const nav = useNavigate();
	const [search, setSearch] = useState('');
	const storeId = active?.id ?? '';
	const filterKey = ordersFilterKey('', search);

	const { data, loading, error } = useCached<Paginated<Discount>>({
		enabled: !!client && !!active,
		read: () => cache.getDiscounts(storeId, filterKey),
		fetch: () => client!.getDiscounts({ search: search || undefined, limit: 30 }),
		write: async (p) => { await cache.putDiscounts(storeId, filterKey, p); },
		deps: [storeId, search],
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
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : items.length === 0 ? (
				<div className="hk-empty">{t('discounts.none')}</div>
			) : (
				<div>
					{items.map((d) => (
						<Link key={d.id} to={`/discounts/${d.id}/edit`} className="hk-row">
							<div className="hk-row-grow">
								<span className="hk-row-title">
									{d.code}
									{!d.published && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('discount.unpublished')}</span>}
								</span>
								<span className="hk-row-sub">{quotaLabel(d)}</span>
							</div>
							<div className="hk-row-rt">
								<span className="hk-row-title">
									{d.kind === 'percent' ? `${d.value}%` : <Money value={d.value} currency={d.currency_id} />}
								</span>
							</div>
						</Link>
					))}
					<div className="hk-muted" style={{ textAlign: 'center', padding: 'var(--hk-s2)' }}>{t('discounts.countOf', { shown: items.length, total })}</div>
				</div>
			)}
		</Screen>
	);
}
