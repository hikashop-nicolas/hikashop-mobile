import { useRef, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import { readAsDataUrl } from '../core';
import type { ProductImage, ProductFile } from '../core';
import { Icon, Spinner } from '../ui';

// Inline image + downloadable-file management for a product, embedded in the edit
// form (upload as base64, delete). Uploads/deletes are immediate (their own writes),
// independent of the core-field Save.
export function ProductMediaSection({ productId, images, files, onChange }: {
	productId: number;
	images: ProductImage[];
	files: ProductFile[];
	onChange: (images: ProductImage[], files: ProductFile[]) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const imgInput = useRef<HTMLInputElement>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	async function onPick(kind: 'images' | 'files', list: FileList | null) {
		if (!client || !list || list.length === 0 || busy) return;
		setErr(''); setBusy(true);
		try {
			const added: ProductFile[] = [];
			for (const f of Array.from(list)) {
				const data = await readAsDataUrl(f);
				added.push(await client.uploadProductMedia(productId, kind, { name: f.name, data }));
			}
			if (kind === 'images') onChange([...images, ...added], files);
			else onChange(images, [...files, ...added]);
		} catch (e) { setErr(codeOf(e, t)); } finally { setBusy(false); }
	}

	async function del(kind: 'images' | 'files', fileId: number) {
		if (!client || busy) return;
		setErr(''); setBusy(true);
		try {
			await client.deleteProductFile(productId, fileId);
			if (kind === 'images') onChange(images.filter((f) => f.id !== fileId), files);
			else onChange(images, files.filter((f) => f.id !== fileId));
		} catch (e) { setErr(codeOf(e, t)); } finally { setBusy(false); }
	}

	return (
		<>
			<div className="hk-card hk-card--pad">
				<span className="hk-muted">{t('product.images')}</span>
				<div className="hk-media-grid">
					{images.map((img) => (
						<div key={img.id} className="hk-media-cell">
							<img src={img.url} alt={img.description || ''} loading="lazy" />
							<button className="hk-media-del" disabled={busy} aria-label={t('common.delete')} onClick={() => void del('images', img.id)}><Icon name="close" size={13} /></button>
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
						<button className="hk-iconbtn hk-danger" disabled={busy} aria-label={t('common.delete')} onClick={() => void del('files', f.id)}><Icon name="trash" size={18} /></button>
					</div>
				))}
				<button className="hk-btn hk-btn--block" style={{ marginTop: 'var(--hk-s2)' }} disabled={busy} onClick={() => fileInput.current?.click()}>
					<span className="hk-btn-ic"><Icon name="plus" size={18} /> {t('product.addFile')}</span>
				</button>
				<input ref={fileInput} type="file" multiple hidden onChange={(e) => void onPick('files', e.target.files)} />
				{busy && <div className="hk-center-col"><Spinner /></div>}
				{err && <div className="hk-error-note">{err}</div>}
			</div>
		</>
	);
}

function codeOf(e: unknown, t: ReturnType<typeof useT>): string {
	const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
	return tError(t, code);
}
