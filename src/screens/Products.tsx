import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { ProductSummary, Paginated, ProductMeta } from '../core';
import { Screen, Search, Money, Spinner, Icon, TreeSelect, NewButton, Button } from '../ui';
import { ScanProductModal } from './ScanProductModal';

export function Products() {
	const { client, active, cache } = useStores();
	const t = useT();
	const nav = useNavigate();
	const [search, setSearch] = useState('');
	const [categoryId, setCategoryId] = useState(0);
	const [showFilter, setShowFilter] = useState(false);
	const [creating, setCreating] = useState(false);
	const [scanning, setScanning] = useState(false);
	const storeId = active?.id ?? '';
	const filterKey = `${ordersFilterKey('', search)}|c${categoryId}`;

	async function create() {
		if (!client || creating) return;
		setCreating(true);
		try {
			const p = await client.createProduct({ name: t('product.newProduct'), published: false });
			await cache.putProduct(storeId, p.id, p);
			nav(`/products/${p.id}/edit`);
		} catch {
			setCreating(false);
		}
	}

	const { data: meta } = useCached<ProductMeta>({
		enabled: !!client && !!active,
		read: () => cache.getProductMeta(storeId),
		fetch: () => client!.getProductMeta(),
		write: async (m) => { await cache.putProductMeta(storeId, m); },
		deps: [storeId],
	});
	const activeCategory = meta?.categories.find((c) => c.id === categoryId);

	const { data, loading, error } = useCached<Paginated<ProductSummary>>({
		enabled: !!client && !!active,
		read: () => cache.getProducts(storeId, filterKey),
		fetch: () => client!.getProducts({ search: search || undefined, category_id: categoryId || undefined, limit: 30 }),
		write: async (p) => { await cache.putProducts(storeId, filterKey, p); },
		deps: [storeId, search, categoryId],
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
		<Screen
			title={t('products.title')}
			right={<>
				<Button size="sm" onClick={() => setScanning(true)}><Icon name="scan" size={16} /> {t('scan.action')}</Button>
				<NewButton disabled={creating} onClick={() => void create()} />
			</>}
		>
			<Search value={search} onChange={setSearch} placeholder={t('products.search')} />
			<div className="hk-filter-bar">
				<button type="button" className={`hk-chip${categoryId ? ' hk-on' : ''}`} onClick={() => setShowFilter((v) => !v)}>
					{activeCategory ? activeCategory.name : t('products.filterByCategory')}
					<Icon name="chevron" size={14} className={showFilter ? 'hk-rot90' : ''} />
				</button>
				{categoryId > 0 && (
					<button type="button" className="hk-chip" onClick={() => { setCategoryId(0); setShowFilter(false); }}>
						{t('products.allCategories')} <Icon name="close" size={13} />
					</button>
				)}
			</div>
			{showFilter && (
				<div style={{ marginBottom: 'var(--hk-s3)' }}>
					<TreeSelect nodes={meta?.categories ?? []} selected={categoryId ? [categoryId] : []} multiple={false}
						onChange={(ids) => { setCategoryId(ids[0] ?? 0); setShowFilter(false); }}
						searchPlaceholder={t('product.searchCategories')} emptyLabel={t('product.noCategories')} />
				</div>
			)}
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
							{p.image
								? <img className="hk-avatar-img" src={p.image} alt="" loading="lazy" />
								: <div className="hk-avatar">{(p.name || '?').charAt(0).toUpperCase()}</div>}
							<div className="hk-row-grow">
								<span className="hk-row-title">{p.name}{!p.published && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('product.unpublished')}</span>}</span>
								<span className="hk-row-sub">{p.code} · {stockLabel(p)}</span>
							</div>
							<div className="hk-row-rt">{p.price !== null && <Money value={p.price} currency={p.currency_id} />}</div>
						</Link>
					))}
					<div className="hk-muted" style={{ textAlign: 'center', padding: 'var(--hk-s2)' }}>{t('products.countOf', { shown: items.length, total })}</div>
				</div>
			)}
			{scanning && (
				<ScanProductModal
					onClose={() => setScanning(false)}
					onOpen={(pid) => { setScanning(false); nav(`/products/${pid}`); }}
				/>
			)}
		</Screen>
	);
}
