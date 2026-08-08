import { useEffect, useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { usePaged } from '../app/use-paged';
import { useSticky } from '../app/use-sticky';
import { useT, tError } from '../i18n';
import { ordersFilterKey } from '../core';
import type { ProductSummary } from '../core';
import { Screen, Search, Money, Spinner, Icon, NewButton, Button, LoadMore } from '../ui';
import { ScanProductModal } from './ScanProductModal';
import { ListingFields } from './ListingFields';
import { CategoryPicker } from './CategoryPicker';
import { useDataChanged } from '../app/data-changed';

// Rows per request. The connector caps a page at 100.
const PAGE = 30;

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string')
		? (e as { code: string }).code
		: 'generic';
}

export function Products() {
	const { client, active, cache } = useStores();
	const t = useT();
	const changed = useDataChanged();
	const nav = useNavigate();
	const [showFilter, setShowFilter] = useState(false);
	const [creating, setCreating] = useState(false);
	const [createErr, setCreateErr] = useState('');
	const [scanning, setScanning] = useState(false);
	const storeId = active?.id ?? '';
	// Kept while you step away to another tab, per store: a category id means nothing elsewhere.
	const [search, setSearch] = useSticky(`products.search.${storeId}`, '');
	const [categoryId, setCategoryId] = useSticky(`products.category.${storeId}`, 0);
	const filterKey = `${ordersFilterKey('', search)}|c${categoryId}`;

	async function create() {
		if (!client || creating) return;
		setCreating(true);
		setCreateErr('');
		try {
			const p = await client.createProduct({ name: t('product.newProduct'), published: false });
			// Priming the cache is a convenience, not part of creating the product: a failure here
			// must not swallow a product that now exists on the shop.
			try { await cache.putProduct(storeId, p.id, p); } catch { /* it will be fetched */ }
			nav(`/products/${p.id}`);
		} catch (e) {
			setCreateErr(tError(t, codeOf(e)));
		} finally {
			// Always, not only on failure: the listing stays mounted beside the product it just
			// opened, so a flag left set here disables the button for good.
			setCreating(false);
		}
	}

	// The name of the category being filtered on, looked up by id rather than found in a copy of
	// the whole tree.
	const [activeCategoryName, setActiveCategoryName] = useState('');
	useEffect(() => {
		if (!client || !categoryId) { setActiveCategoryName(''); return; }
		let alive = true;
		void client.listCategories({ type: 'product', ids: [categoryId] })
			.then((page) => { if (alive) setActiveCategoryName(page.items[0]?.name ?? ''); })
			.catch(() => { if (alive) setActiveCategoryName(''); });
		return () => { alive = false; };
	}, [client, categoryId]);

	const { items, total, fields, loading, error, hasMore, loadingMore, moreError, loadMore } = usePaged<ProductSummary>({
		enabled: !!client && !!active,
		read: () => cache.getProducts(storeId, filterKey),
		fetch: (start) => client!.getProducts({ search: search || undefined, category_id: categoryId || undefined, limit: PAGE, start }),
		write: async (p) => { await cache.putProducts(storeId, filterKey, p); },
		deps: [storeId, search, categoryId, changed.version('products')],
		debounceMs: search ? 300 : 0,
	});


	function stockLabel(p: ProductSummary): string {
		if (p.has_variants) return '';
		if (p.quantity < 0) return t('product.unlimited');
		return t('product.inStock', { count: p.quantity });
	}

	return (
		<Screen
			scrollResetKey={`${categoryId}|${search}`}
			title={t('products.title')}
			right={<>
				<Button size="sm" onClick={() => setScanning(true)}><Icon name="scan" size={16} /> {t('scan.action')}</Button>
				<NewButton disabled={creating} onClick={() => void create()} />
			</>}
		>
			<Search value={search} onChange={setSearch} placeholder={t('products.search')} />
			<div className="hk-filter-bar">
				<button type="button" className={`hk-chip${categoryId ? ' hk-on' : ''}`} onClick={() => setShowFilter((v) => !v)}>
					{activeCategoryName || t('products.filterByCategory')}
					<Icon name="chevron" size={14} className={showFilter ? 'hk-rot90' : ''} />
				</button>
				{categoryId > 0 && (
					<button type="button" className="hk-chip" onClick={() => { setCategoryId(0); setShowFilter(false); }}>
						{t('products.allCategories')} <Icon name="close" size={13} />
					</button>
				)}
			</div>
			{createErr && <div className="hk-error-note">{createErr}</div>}
			{showFilter && (
				<div style={{ marginBottom: 'var(--hk-s3)' }}>
					<CategoryPicker type="product" selected={categoryId ? [categoryId] : []} multiple={false}
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
						<NavLink key={p.id} to={`/products/${p.id}`} className={({ isActive }) => `hk-row${isActive ? ' hk-row--on' : ''}`}>
							{p.image
								? <img className="hk-avatar-img" src={p.image} alt="" loading="lazy" />
								: <div className="hk-avatar">{(p.name || '?').charAt(0).toUpperCase()}</div>}
							<div className="hk-row-grow">
								<span className="hk-row-title">{p.name}{!p.published && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('product.unpublished')}</span>}</span>
								<span className="hk-row-sub">{p.code} · {stockLabel(p)}</span>
								<ListingFields fields={fields} values={p.custom_fields} />
							</div>
							<div className="hk-row-rt">{p.price !== null && <Money value={p.price} currency={p.currency_id} />}</div>
						</NavLink>
					))}
					<LoadMore shown={items.length} total={total} hasMore={hasMore} loading={loadingMore} error={moreError} onLoad={loadMore} />
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
