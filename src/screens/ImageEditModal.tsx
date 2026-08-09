import { useEffect, useRef, useState } from 'react';
import { Cropt } from 'cropt';
import 'cropt/src/cropt.css';
import { Modal, Button, Spinner, Icon } from '../ui';
import { useT } from '../i18n';

// Crop, rotate and resize an image before it is attached.
//
// The result is always a new file. The library image it came from may be attached to other
// products, and quietly changing what those show is not what somebody cropping a picture is
// asking for.
//
// Cropt (MIT, no dependencies) does the interaction: drag to move, scroll or pinch to zoom,
// the handles to set any shape, the buttons to rotate.
//
// There were shape and size choices here and they are gone. The shapes repeated what the
// handles already do, and the size only changed something you could not see until after saving.
// What comes out is now what was cropped, at the resolution it was cropped from, and the shop's
// own image settings resize it on upload as they do for every other picture.

export function ImageEditModal({ src, name, onClose, onSave }: {
	/** An object URL, so the pixels are same-origin and the canvas can be read. */
	src: string;
	name: string;
	onClose: () => void;
	onSave: (blob: Blob, name: string) => Promise<void>;
}) {
	const t = useT();
	const host = useRef<HTMLDivElement>(null);
	const cropt = useRef<Cropt | null>(null);
	const [ready, setReady] = useState(false);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	useEffect(() => {
		const el = host.current;
		if (!el) return;
		const c = new Cropt(el, {
			viewport: { width: 260, height: 260, borderRadius: '0' },
			mouseWheelZoom: 'on',
			enableResize: true,
			enableRotate: true,
		});
		cropt.current = c;
		let alive = true;
		void c.bind(src).then(() => { if (alive) setReady(true); })
			.catch(() => { if (alive) setErr(t('media.editFailed')); });
		return () => { alive = false; c.destroy(); cropt.current = null; };
	}, [src, t]);

	async function save() {
		const c = cropt.current;
		if (!c || busy) return;
		setBusy(true); setErr('');
		try {
			const blob = await c.toBlob(null, 'image/jpeg', 0.9);
			await onSave(blob, editedName(name));
		} catch {
			setErr(t('media.editFailed'));
			setBusy(false);
		}
	}

	return (
		<Modal
			title={t('media.editTitle')}
			onClose={onClose}
			footer={<>
				<Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
				<Button variant="pri" disabled={busy || !ready} onClick={() => void save()}>
					<Icon name="check" size={16} /> {busy ? t('product.saving') : t('media.editSave')}
				</Button>
			</>}
		>
			<div className="hk-imgedit">
				<div ref={host} className="hk-imgedit-stage" />
				{!ready && !err && <div className="hk-center-col"><Spinner /></div>}
				<p className="hk-hint">{t('media.editHint')}</p>
			</div>
			{err && <div className="hk-error-note">{err}</div>}
		</Modal>
	);
}

// "photo.png" cropped becomes "photo-edited.jpg": a new file, and one whose name says so. The
// output is a jpeg whatever went in, so the extension has to follow.
function editedName(name: string): string {
	const dot = name.lastIndexOf('.');
	const stem = dot > 0 ? name.slice(0, dot) : name;
	return `${stem}-edited.jpg`;
}
