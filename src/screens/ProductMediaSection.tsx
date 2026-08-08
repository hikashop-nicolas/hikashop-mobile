import { useRef, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import { readAsDataUrl } from '../core';
import type { ProductImage, ProductFile } from '../core';
import { Icon, Spinner, Button, ImageViewer } from '../ui';
import { FileOptionsModal } from './FileOptionsModal';
import { MediaBrowser } from './MediaBrowser';
import { accessSummary } from './AccessField';

// Inline image + downloadable-file management for a product, embedded in the edit
// form: upload (base64 or drag & drop), attach an already-uploaded file via the media
// browser, edit each file's options, reorder and delete. Writes are immediate.
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
	const [dragOver, setDragOver] = useState<'images' | 'files' | null>(null);
	const [browsing, setBrowsing] = useState<'images' | 'files' | null>(null);
	const [editing, setEditing] = useState<{ file: ProductFile; kind: 'images' | 'files' } | null>(null);
	const [viewing, setViewing] = useState<number | null>(null);
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

	// Drop files onto an area to upload them (images area accepts image types only).
	function onDrop(kind: 'images' | 'files', e: React.DragEvent) {
		e.preventDefault();
		setDragOver(null);
		const dropped = Array.from(e.dataTransfer.files).filter((f) => kind === 'files' || f.type.startsWith('image/'));
		if (dropped.length) {
			const dt = new DataTransfer();
			dropped.forEach((f) => dt.items.add(f));
			void onPick(kind, dt.files);
		}
	}

	// Attach an already-uploaded file chosen in the media browser.
	async function attachFromBrowser(kind: 'images' | 'files', path: string, name: string) {
		if (!client) return;
		const added = await client.attachProductMedia(productId, kind, { path, name });
		if (kind === 'images') onChange([...images, added], files);
		else onChange(images, [...files, added]);
		setBrowsing(null);
	}

	function onFileEdited(updated: ProductFile) {
		if (!editing) return;
		if (editing.kind === 'images') onChange(images.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)), files);
		else onChange(images, files.map((f) => (f.id === updated.id ? updated : f)));
		setEditing(null);
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

	// Move an image one slot earlier/later and persist the new order.
	async function moveImage(index: number, dir: -1 | 1) {
		if (!client || busy) return;
		const to = index + dir;
		if (to < 0 || to >= images.length) return;
		const next = images.slice();
		[next[index], next[to]] = [next[to], next[index]];
		onChange(next, files);
		setErr(''); setBusy(true);
		try {
			await client.setProductMediaOrder(productId, { images: next.map((i) => i.id) });
		} catch (e) { setErr(codeOf(e, t)); onChange(images, files); } finally { setBusy(false); }
	}

	return (
		<>
			<div className="hk-card hk-card--pad">
				<div className="hk-sect-head"><span className="hk-muted">{t('product.images')}</span>
					<Button size="sm" disabled={busy} onClick={() => setBrowsing('images')}>{t('media.browse')}</Button></div>
				<div className={`hk-media-grid hk-dropzone${dragOver === 'images' ? ' hk-dragover' : ''}`}
					onDragOver={(e) => { e.preventDefault(); setDragOver('images'); }}
					onDragLeave={() => setDragOver(null)}
					onDrop={(e) => onDrop('images', e)}>
					{images.map((img, i) => (
						<div key={img.id} className="hk-media-cell">
							<img src={img.url} alt={img.description || ''} loading="lazy" />
							<button className="hk-media-del" disabled={busy} aria-label={t('common.delete')} onClick={() => void del('images', img.id)}><Icon name="close" size={13} /></button>
							<button className="hk-media-edit" disabled={busy} aria-label={t('media.editImage')} onClick={() => setEditing({ file: img as ProductFile, kind: 'images' })}><Icon name="edit" size={13} /></button>
							<button className="hk-media-view" aria-label={t('media.viewImage')} onClick={() => setViewing(i)}><Icon name="eye" size={13} /></button>
							{images.length > 1 && (
								<div className="hk-media-move">
									<button disabled={busy || i === 0} aria-label={t('product.moveEarlier')} onClick={() => void moveImage(i, -1)}><Icon name="chevron" size={14} className="hk-rot180" /></button>
									<button disabled={busy || i === images.length - 1} aria-label={t('product.moveLater')} onClick={() => void moveImage(i, 1)}><Icon name="chevron" size={14} /></button>
								</div>
							)}
						</div>
					))}
					<button className="hk-media-add" disabled={busy} onClick={() => imgInput.current?.click()}><Icon name="plus" size={22} /></button>
				</div>
				{dragOver === 'images' && <div className="hk-muted" style={{ textAlign: 'center', marginTop: 'var(--hk-s2)' }}>{t('media.dropHint')}</div>}
				<input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={(e) => void onPick('images', e.target.files)} />
			</div>

			<div className="hk-card hk-card--pad">
				<div className="hk-sect-head"><span className="hk-muted">{t('product.files')}</span>
					<Button size="sm" disabled={busy} onClick={() => setBrowsing('files')}>{t('media.browse')}</Button></div>
				<div className={`hk-dropzone hk-filedrop${dragOver === 'files' ? ' hk-dragover' : ''}`}
					onDragOver={(e) => { e.preventDefault(); setDragOver('files'); }}
					onDragLeave={() => setDragOver(null)}
					onDrop={(e) => onDrop('files', e)}>
					{files.map((f) => (
						<div key={f.id} className="hk-row">
							<button type="button" className="hk-row-grow hk-row-btn" onClick={() => setEditing({ file: f, kind: 'files' })}><span className="hk-row-title">{f.name}</span>{accessSummary(f.access, t) && <span className="hk-row-sub">{accessSummary(f.access, t)}</span>}</button>
							<button className="hk-iconbtn hk-danger" disabled={busy} aria-label={t('common.delete')} onClick={() => void del('files', f.id)}><Icon name="trash" size={18} /></button>
						</div>
					))}
					<Button block style={{ marginTop: 'var(--hk-s2)' }} disabled={busy} onClick={() => fileInput.current?.click()}>
						<Icon name="plus" size={18} /> {t('product.addFile')}
					</Button>
				</div>
				{dragOver === 'files' && <div className="hk-muted" style={{ textAlign: 'center', marginTop: 'var(--hk-s2)' }}>{t('media.dropFileHint')}</div>}
				<input ref={fileInput} type="file" multiple hidden onChange={(e) => void onPick('files', e.target.files)} />
				{busy && <div className="hk-center-col"><Spinner /></div>}
				{err && <div className="hk-error-note">{err}</div>}
			</div>

			{viewing !== null && (
				<ImageViewer
					images={images.map((i) => ({ url: i.url, label: i.name || i.description || '' }))}
					start={viewing}
					onClose={() => setViewing(null)} />
			)}

			{browsing && <MediaBrowser kind={browsing} onClose={() => setBrowsing(null)} onPick={(path, name) => attachFromBrowser(browsing, path, name)} />}
			{editing && <FileOptionsModal productId={productId} file={editing.file} kind={editing.kind} onClose={() => setEditing(null)} onSaved={onFileEdited} />}
		</>
	);
}

function codeOf(e: unknown, t: ReturnType<typeof useT>): string {
	const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
	return tError(t, code);
}
