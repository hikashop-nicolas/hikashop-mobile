import { useEffect, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { MediaListing } from '../core';
import { Modal, Button, Spinner, Icon } from '../ui';

// A HikaShop-style media picker: folders on the left, images on the right. Selecting
// an image and confirming attaches it (by path) to the product.
export function MediaBrowser({ onClose, onPick }: {
	onClose: () => void;
	onPick: (path: string, name: string) => Promise<void>;
}) {
	const { client } = useStores();
	const t = useT();
	const [listing, setListing] = useState<MediaListing | null>(null);
	const [folder, setFolder] = useState('');
	const [loading, setLoading] = useState(true);
	const [err, setErr] = useState('');
	const [selected, setSelected] = useState<{ path: string; name: string } | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!client) return;
		let alive = true;
		setLoading(true); setErr('');
		void (async () => {
			try {
				const l = await client.browseMedia(folder);
				if (alive) { setListing(l); setSelected(null); }
			} catch (e) {
				if (alive) setErr(tError(t, codeOf(e)));
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => { alive = false; };
	}, [client, folder, t]);

	async function attach() {
		if (!selected || busy) return;
		setBusy(true); setErr('');
		try {
			await onPick(selected.path, selected.name);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	return (
		<Modal title={t('media.browseTitle')} onClose={onClose}
			footer={<>
				<Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
				<Button variant="pri" onClick={() => void attach()} disabled={busy || !selected}>{busy ? t('product.saving') : t('media.useImage')}</Button>
			</>}
		>
			<div className="hk-mb">
				<div className="hk-mb-tree">
					<button type="button" className={`hk-mb-folder${folder === '' ? ' hk-on' : ''}`} onClick={() => setFolder('')}>
						<Icon name="categories" size={16} /> {t('media.rootFolder')}
					</button>
					{listing?.has_parent && (
						<button type="button" className="hk-mb-folder" onClick={() => setFolder(listing.parent)}>
							<Icon name="back" size={16} /> {t('media.parentFolder')}
						</button>
					)}
					{(listing?.folders ?? []).map((f) => (
						<button key={f.path} type="button" className={`hk-mb-folder${folder === f.path ? ' hk-on' : ''}`} onClick={() => setFolder(f.path)}>
							<Icon name="categories" size={16} /> {f.name}
						</button>
					))}
				</div>
				<div className="hk-mb-grid">
					{loading ? (
						<div className="hk-center-col"><Spinner /></div>
					) : (listing?.images ?? []).length === 0 ? (
						<div className="hk-empty">{t('media.noImages')}</div>
					) : (
						<div className="hk-media-grid">
							{listing!.images.map((img) => (
								<button key={img.path} type="button" className={`hk-media-cell hk-mb-cell${selected?.path === img.path ? ' hk-on' : ''}`} onClick={() => setSelected({ path: img.path, name: img.name })} title={img.name}>
									<img src={img.url} alt={img.name} loading="lazy" />
								</button>
							))}
						</div>
					)}
				</div>
			</div>
			{err && <div className="hk-error-note">{err}</div>}
		</Modal>
	);
}

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}
