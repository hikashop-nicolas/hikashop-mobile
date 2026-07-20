import { useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { ProductFile } from '../core';
import { Modal, Field, Button } from '../ui';

// Edit one file's options: name, description, access, and (for downloadable files)
// the free-download flag. Persists via PUT /products/{id}/files/{fileId}.
export function FileOptionsModal({ productId, file, kind, accessLevels, onClose, onSaved }: {
	productId: number;
	file: ProductFile;
	kind: 'images' | 'files';
	accessLevels: { id: number; name: string }[];
	onClose: () => void;
	onSaved: (file: ProductFile) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [name, setName] = useState(file.name);
	const [description, setDescription] = useState(file.description);
	const [access, setAccess] = useState(file.access || 'all');
	const [freeDownload, setFreeDownload] = useState(file.free_download);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	async function save() {
		if (!client || busy) return;
		setErr(''); setBusy(true);
		try {
			const updated = await client.updateProductFile(productId, file.id, {
				name, description, access,
				...(kind === 'files' ? { free_download: freeDownload } : {}),
			});
			onSaved(updated);
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setErr(tError(t, code));
			setBusy(false);
		}
	}

	return (
		<Modal title={t('media.editImage')} onClose={onClose}
			footer={<>
				<Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
				<Button variant="pri" onClick={() => void save()} disabled={busy}>{busy ? t('product.saving') : t('common.save')}</Button>
			</>}
		>
			<div className="hk-form">
				{kind === 'images' && file.url && <img className="hk-cat-img" src={file.url} alt="" style={{ width: '120px', height: '120px' }} />}
				<Field label={t('media.name')}><input className="hk-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
				<Field label={t('media.description')}><textarea className="hk-input hk-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
				<Field label={t('product.access')}>
					<select className="hk-select" value={access} onChange={(e) => setAccess(e.target.value)}>
						<option value="all">{t('product.allUsers')}</option>
						{accessLevels.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
					</select>
				</Field>
				{kind === 'files' && (
					<label className="hk-check"><input type="checkbox" checked={freeDownload} onChange={(e) => setFreeDownload(e.target.checked)} /><span>{t('media.freeDownload')}</span></label>
				)}
				{err && <div className="hk-error-note">{err}</div>}
			</div>
		</Modal>
	);
}
