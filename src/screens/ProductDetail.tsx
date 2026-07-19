import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail as ProductDetailType } from '../core';
import { Screen, Money, Spinner, Button, Icon } from '../ui';

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

	return (
		<Screen
			title={product ? product.name : t('product.titleFallback')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
		>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : product ? (
				<>
					<div className="hk-card hk-card--pad">
						<div className="hk-row" style={{ borderBottom: 'none', padding: 0 }}>
							<div className="hk-row-grow">
								<span className="hk-row-title">{product.name}</span>
								<span className="hk-row-sub">{t('product.sku')}: {product.code || '-'}</span>
							</div>
							{!product.published && <span className="hk-status hk-status--neutral">{t('product.unpublished')}</span>}
						</div>
						{product.price !== null && (
							<div className="hk-row"><div className="hk-row-grow"><span className="hk-row-sub">{t('product.price')}</span></div><Money value={product.price} /></div>
						)}
						{product.description && <p className="hk-muted" style={{ marginTop: 'var(--hk-s2)' }}>{product.description}</p>}
					</div>

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('product.stock')}</span>
						{product.has_variants ? (
							<div className="hk-empty">{t('product.variantsManaged')}</div>
						) : (
							<>
								<div className="hk-row" style={{ borderBottom: 'none' }}>
									<input
										className="hk-input"
										type="number"
										inputMode="numeric"
										value={stockInput}
										placeholder={t('product.unlimited')}
										disabled={busy}
										onChange={(e) => setStockInput(e.target.value)}
										style={{ maxWidth: '9rem' }}
									/>
									<Button variant="pri" disabled={busy} onClick={() => void saveStock(stockInput.trim() === '' ? -1 : parseInt(stockInput, 10) || 0)}>
										{busy ? t('product.saving') : t('product.updateStock')}
									</Button>
								</div>
								<button className="hk-btn hk-btn--ghost" disabled={busy} onClick={() => void saveStock(-1)} style={{ marginTop: 'var(--hk-s2)' }}>
									{t('product.setUnlimited')}
								</button>
								{saveErr && <div className="hk-error-note" style={{ marginTop: 'var(--hk-s3)' }}>{saveErr}</div>}
							</>
						)}
					</div>
				</>
			) : null}
		</Screen>
	);
}
