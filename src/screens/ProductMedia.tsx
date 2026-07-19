import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail, ProductFile } from '../core';
import { readAsDataUrl } from '../core';
import { Screen, Spinner, Icon } from '../ui';

export function ProductMedia() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const t = useT();
	const storeId = active?.id ?? '';
	const productId = Number(id);

	const { data: product, loading, error } = useCached<ProductDetail>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getProduct(storeId, productId),
		fetch: () => client!.getProduct(productId),
		write: async (p) => { await cache.putProduct(storeId, productId, p); },
		deps: [storeId, productId],
	});

	const [images, setImages] = useState<ProductFile[] | null>(null);
	const [files, setFiles] = useState<ProductFile[] | null>(null);
	useEffect(() => {
		if (product && images === null) { setImages(product.images as ProductFile[]); setFiles(product.files); }
	}, [product, images]);

	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const imgInput = useRef<HTMLInputElement>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	async function persist(nextImages: ProductFile[], nextFiles: ProductFile[]) {
		if (product) await cache.putProduct(storeId, productId, { ...product, images: nextImages, files: nextFiles });
	}

	async function onPick(kind: 'images' | 'files', list: FileList | null) {
		if (!client || !list || list.length === 0 || busy) return;
		setErr('');
		setBusy(true);
		try {
			const added: ProductFile[] = [];
			for (const f of Array.from(list)) {
				const data = await readAsDataUrl(f);
				const uploaded = await client.uploadProductMedia(productId, kind, { name: f.name, data });
				added.push(uploaded);
			}
			if (kind === 'images') {
				const next = [...(images ?? []), ...added];
				setImages(next);
				await persist(next, files ?? []);
			} else {
				const next = [...(files ?? []), ...added];
				setFiles(next);
				await persist(images ?? [], next);
			}
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setErr(tError(t, code));
		} finally {
			setBusy(false);
		}
	}

	async function del(kind: 'images' | 'files', fileId: number) {
		if (!client || busy) return;
		setErr('');
		setBusy(true);
		try {
			await client.deleteProductFile(productId, fileId);
			if (kind === 'images') {
				const next = (images ?? []).filter((f) => f.id !== fileId);
				setImages(next);
				await persist(next, files ?? []);
			} else {
				const next = (files ?? []).filter((f) => f.id !== fileId);
				setFiles(next);
				await persist(images ?? [], next);
			}
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setErr(tError(t, code));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen
			title={t('product.editMedia')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
		>
			{loading || images === null || files === null ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : (
				<div className="hk-bento">
					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('product.images')}</span>
						<div className="hk-media-grid">
							{images.map((img) => (
								<div key={img.id} className="hk-media-cell">
									<img src={img.url} alt={img.description || ''} loading="lazy" />
									<button className="hk-media-del" disabled={busy} aria-label={t('common.delete')} onClick={() => void del('images', img.id)}>×</button>
								</div>
							))}
							<button className="hk-media-add" disabled={busy} onClick={() => imgInput.current?.click()}><Icon name="plus" size={22} /></button>
						</div>
						<input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={(e) => void onPick('images', e.target.files)} />
					</div>

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('product.files')}</span>
						{files.map((f) => (
							<div key={f.id} className="hk-row">
								<div className="hk-row-grow"><span className="hk-row-title">{f.name}</span>{f.access && <span className="hk-row-sub">{f.access}</span>}</div>
								<button className="hk-btn hk-btn--danger" style={{ minHeight: '32px', padding: '0 10px' }} disabled={busy} onClick={() => void del('files', f.id)}>{t('common.delete')}</button>
							</div>
						))}
						<button className="hk-btn hk-btn--block" style={{ marginTop: 'var(--hk-s2)' }} disabled={busy} onClick={() => fileInput.current?.click()}>
							<span className="hk-btn-ic"><Icon name="plus" size={18} /> {t('product.addFile')}</span>
						</button>
						<input ref={fileInput} type="file" multiple hidden onChange={(e) => void onPick('files', e.target.files)} />
					</div>

					{busy && <div className="hk-center-col"><Spinner /></div>}
					{err && <div className="hk-error-note">{err}</div>}
				</div>
			)}
		</Screen>
	);
}
