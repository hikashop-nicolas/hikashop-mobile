import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { ProductSummary, Paginated } from '../core';
import { Screen, Search, Money, Spinner } from '../ui';

export function Products() {
	const { client, active, cache } = useStores();
	const t = useT();
	const [search, setSearch] = useState('');
	const storeId = active?.id ?? '';
	const filterKey = ordersFilterKey('', search);

	const { data, loading, error } = useCached<Paginated<ProductSummary>>({
		enabled: !!client && !!active,
		read: () => cache.getProducts(storeId, filterKey),
		fetch: () => client!.getProducts({ search: search || undefined, limit: 30 }),
		write: async (p) => { await cache.putProducts(storeId, filterKey, p); },
		deps: [storeId, search],
		debounceMs: search ? 300 : 0,
	});

	const items = data?.items ?? [];
	const total = data?.total ?? 0;

	function stockLabel(p: ProductSummary): string {
		if (p.has_variants) return '';
		if (p.quantity < 0) return t('product.unlimited');
		return t('product.inStock', { count: p.quantity });
	}

	return (
		<Screen title={t('products.title')}>
			<Search value={search} onChange={setSearch} placeholder={t('products.search')} />
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : items.length === 0 ? (
				<div className="hk-empty">{t('products.none')}</div>
			) : (
				<div>
					{items.map((p) => (
						<Link key={p.id} to={`/products/${p.id}`} className="hk-row">
							<div className="hk-avatar">{(p.name || '?').charAt(0).toUpperCase()}</div>
							<div className="hk-row-grow">
								<span className="hk-row-title">{p.name}{!p.published && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('product.unpublished')}</span>}</span>
								<span className="hk-row-sub">{p.code} · {stockLabel(p)}</span>
							</div>
							<div className="hk-row-rt">{p.price !== null && <Money value={p.price} />}</div>
						</Link>
					))}
					<div className="hk-muted" style={{ textAlign: 'center', padding: 'var(--hk-s2)' }}>{t('products.countOf', { shown: items.length, total })}</div>
				</div>
			)}
		</Screen>
	);
}
