import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { TFunc } from '../i18n';
import type { ProductDetail as ProductDetailType, ProductMeta, ProductPrice, ProductVariant } from '../core';
import { Screen, Money, Spinner, Button, Icon } from '../ui';

function priceText(p: ProductPrice, meta: ProductMeta | null): string {
	const cur = meta?.currencies.find((c) => c.id === p.currency_id);
	const amount = p.value.toFixed(2);
	return cur ? `${cur.symbol}${amount} ${cur.code}` : amount;
}

function variantLabel(v: ProductVariant): string {
	return v.values.map((x) => x.value).join(' / ') || v.code;
}

function Stock({ product, t }: { product: ProductDetailType; t: TFunc }) {
	if (product.quantity < 0) return <span className="hk-status hk-status--ok">{t('product.unlimited')}</span>;
	if (product.quantity === 0) return <span className="hk-status hk-status--crit">{t('product.inStock', { count: 0 })}</span>;
	return <span className="hk-status hk-status--ok">{t('product.inStock', { count: product.quantity })}</span>;
}

export function ProductDetail() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const t = useT();
	const storeId = active?.id ?? '';
	const productId = Number(id);

	const { data: fetched, loading, error } = useCached<ProductDetailType>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getProduct(storeId, productId),
		fetch: () => client!.getProduct(productId),
		write: async (p) => { await cache.putProduct(storeId, productId, p); },
		deps: [storeId, productId],
	});

	const { data: meta } = useCached<ProductMeta>({
		enabled: !!client && !!active,
		read: () => cache.getProductMeta(storeId),
		fetch: () => client!.getProductMeta(),
		write: async (m) => { await cache.putProductMeta(storeId, m); },
		deps: [storeId],
	});

	const [product, setProduct] = useState<ProductDetailType | null>(null);
	const [stockInput, setStockInput] = useState('');
	useEffect(() => {
		if (fetched) {
			setProduct(fetched);
			setStockInput(fetched.quantity >= 0 ? String(fetched.quantity) : '');
		}
	}, [fetched]);

	const [busy, setBusy] = useState(false);
	const [saveErr, setSaveErr] = useState('');

	async function saveStock(quantity: number) {
		if (!client || !product || busy) return;
		setSaveErr('');
		setBusy(true);
		try {
			const res = await client.setProductStock(productId, quantity);
			const next: ProductDetailType = { ...product, quantity: res.quantity };
			setProduct(next);
			setStockInput(res.quantity >= 0 ? String(res.quantity) : '');
			await cache.putProduct(storeId, productId, next);
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setSaveErr(tError(t, code));
		} finally {
			setBusy(false);
		}
	}

	const hasVariants = !!product && product.variants.length > 0;
	const description = (product?.description || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

	return (
		<Screen
			title={product ? product.name : t('product.titleFallback')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={product && !product.published ? <span className="hk-status hk-status--neutral">{t('product.unpublished')}</span> : undefined}
		>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : product ? (
				<>
					{product.images.length > 0 && (
						<div className="hk-gallery">
							{product.images.map((img) => (
								<img key={img.id} className="hk-gallery-img" src={img.url} alt={img.description || product.name} loading="lazy" />
							))}
						</div>
					)}

					<div className="hk-card hk-card--pad">
						<div className="hk-row-title">{product.name}</div>
						<div className="hk-row-sub">{t('product.sku')}: {product.code || '-'}</div>
					</div>

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('product.pricing')}</span>
						{product.prices.length === 0 ? (
							<div className="hk-empty">{t('product.noPrice')}</div>
						) : (
							product.prices.map((p) => (
								<div key={p.id} className="hk-row">
									<div className="hk-row-grow">
										<span className="hk-row-title">{priceText(p, meta)}</span>
										<span className="hk-row-sub">{p.min_quantity > 1 ? t('product.priceFrom', { qty: p.min_quantity }) : ''}{p.access ? ` · ${p.access}` : ''}</span>
									</div>
								</div>
							))
						)}
					</div>

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('product.inventory')}</span>
						<div className="hk-row">
							<div className="hk-row-grow"><span className="hk-row-title">{t('product.stock')}</span></div>
							<div className="hk-row-rt"><Stock product={product} t={t} /></div>
						</div>
						{!hasVariants && (
							<>
								<div className="hk-row" style={{ borderBottom: 'none' }}>
									<input className="hk-input" type="number" inputMode="numeric" value={stockInput} placeholder={t('product.unlimited')}
										disabled={busy} onChange={(e) => setStockInput(e.target.value)} style={{ maxWidth: '9rem' }} />
									<Button variant="pri" disabled={busy} onClick={() => void saveStock(stockInput.trim() === '' ? -1 : parseInt(stockInput, 10) || 0)}>
										{busy ? t('product.saving') : t('product.updateStock')}
									</Button>
								</div>
								{saveErr && <div className="hk-error-note" style={{ marginTop: 'var(--hk-s2)' }}>{saveErr}</div>}
							</>
						)}
						{(product.weight > 0) && (
							<div className="hk-row"><div className="hk-row-grow"><span className="hk-row-title">{t('product.weight')}</span></div><span className="hk-money">{product.weight} {product.weight_unit}</span></div>
						)}
						{(product.width > 0 || product.height > 0 || product.length > 0) && (
							<div className="hk-row"><div className="hk-row-grow"><span className="hk-row-title">{t('product.dimensions')}</span></div><span className="hk-money">{product.width} × {product.height} × {product.length} {product.dimension_unit}</span></div>
						)}
						{(product.min_per_order > 0 || product.max_per_order > 0) && (
							<div className="hk-row"><div className="hk-row-grow"><span className="hk-row-title">{t('product.orderLimits')}</span></div><span className="hk-money">{product.min_per_order || '—'} / {product.max_per_order || '—'}</span></div>
						)}
					</div>

					{description && (
						<div className="hk-card hk-card--pad">
							<span className="hk-muted">{t('product.description')}</span>
							<p style={{ margin: '6px 0 0' }}>{description}</p>
						</div>
					)}

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('product.organization')}</span>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hk-s2)', margin: '8px 0' }}>
							{product.categories.length === 0 ? <span className="hk-muted">{t('product.none')}</span>
								: product.categories.map((c) => <span key={c.id} className="hk-chip hk-on">{c.name}</span>)}
						</div>
						{product.manufacturer_name && (
							<div className="hk-row"><div className="hk-row-grow"><span className="hk-row-title">{t('product.manufacturer')}</span></div><span className="hk-row-sub">{product.manufacturer_name}</span></div>
						)}
						{product.tax_name && (
							<div className="hk-row"><div className="hk-row-grow"><span className="hk-row-title">{t('product.tax')}</span></div><span className="hk-row-sub">{product.tax_name}</span></div>
						)}
					</div>

					{hasVariants && (
						<div className="hk-card hk-card--pad">
							<span className="hk-muted">{t('product.variants')}</span>
							<div className="hk-row-sub" style={{ margin: '4px 0 8px' }}>{t('product.variantsSummary', { options: product.characteristics.length, count: product.variants.length })}</div>
							{product.characteristics.map((ch) => (
								<div key={ch.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--hk-s2)', alignItems: 'center', marginBottom: 'var(--hk-s2)' }}>
									<span className="hk-row-sub" style={{ minWidth: '3rem' }}>{ch.name}</span>
									{ch.values.map((v) => <span key={v.id} className="hk-chip">{v.value}</span>)}
								</div>
							))}
							<div style={{ marginTop: 'var(--hk-s2)' }}>
								{product.variants.map((v) => (
									<div key={v.id} className="hk-row">
										<div className="hk-row-grow">
											<span className="hk-row-title">{variantLabel(v)}</span>
											<span className="hk-row-sub hk-mono">{v.code}</span>
										</div>
										<div className="hk-row-rt">
											{v.quantity >= 0
												? <span className={`hk-status hk-status--${v.quantity === 0 ? 'crit' : v.quantity <= 3 ? 'warn' : 'ok'}`}>{v.quantity}</span>
												: <span className="hk-status hk-status--ok">∞</span>}
											{v.price !== null && <Money value={v.price} />}
											{!v.published && <span className="hk-status hk-status--neutral">{t('product.unpublished')}</span>}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{product.files.length > 0 && (
						<div className="hk-card hk-card--pad">
							<span className="hk-muted">{t('product.files')}</span>
							{product.files.map((f) => (
								<div key={f.id} className="hk-row">
									<div className="hk-row-grow"><span className="hk-row-title">{f.name}</span></div>
									{f.access && <span className="hk-status hk-status--neutral">{f.access}</span>}
								</div>
							))}
						</div>
					)}

					{(product.page_title || product.meta_description || product.keywords) && (
						<div className="hk-card hk-card--pad">
							<span className="hk-muted">{t('product.seo')}</span>
							{product.page_title && <div className="hk-row"><div className="hk-row-grow"><span className="hk-row-title">{t('product.pageTitle')}</span><span className="hk-row-sub">{product.page_title}</span></div></div>}
							{product.meta_description && <div className="hk-row"><div className="hk-row-grow"><span className="hk-row-title">{t('product.metaDescription')}</span><span className="hk-row-sub">{product.meta_description}</span></div></div>}
							{product.keywords && <div className="hk-row"><div className="hk-row-grow"><span className="hk-row-title">{t('product.keywords')}</span><span className="hk-row-sub">{product.keywords}</span></div></div>}
						</div>
					)}
				</>
			) : null}
		</Screen>
	);
}
