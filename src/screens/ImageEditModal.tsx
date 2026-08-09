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
// Cropt (MIT, no dependencies) does the interaction; the sizes below decide what comes out.
const SIZES = [
	{ key: 'original', px: 0 },
	{ key: 'large', px: 1600 },
	{ key: 'medium', px: 800 },
	{ key: 'small', px: 400 },
];

// Aspect ratios offered for the viewport, as width/height.
const SHAPES = [
	{ key: 'square', w: 1, h: 1 },
	{ key: 'landscape', w: 4, h: 3 },
	{ key: 'portrait', w: 3, h: 4 },
	{ key: 'wide', w: 16, h: 9 },
];

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
	const [shape, setShape] = useState(SHAPES[0]);
	const [size, setSize] = useState(SIZES[1]);

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

	// The viewport is what the crop follows, so a shape change is a viewport change.
	useEffect(() => {
		const c = cropt.current;
		if (!c || !ready) return;
		const base = 260;
		const w = shape.w >= shape.h ? base : Math.round((base * shape.w) / shape.h);
		const h = shape.w >= shape.h ? Math.round((base * shape.h) / shape.w) : base;
		c.setOptions({ viewport: { width: w, height: h, borderRadius: '0' } });
		c.refresh();
	}, [shape, ready]);

	async function save() {
		const c = cropt.current;
		if (!c || busy) return;
		setBusy(true); setErr('');
		try {
			// px is the longest side of the result; 0 keeps the cropped pixels as they are.
			const blob = await c.toBlob(size.px || null, 'image/jpeg', 0.9);
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

				<div className="hk-imgedit-controls">
					<div className="hk-field">
						<span className="hk-label">{t('media.editShape')}</span>
						<div className="hk-chiprow">
							{SHAPES.map((s) => (
								<button key={s.key} type="button" aria-pressed={shape.key === s.key}
									className={`hk-chip${shape.key === s.key ? ' hk-on' : ''}`}
									onClick={() => setShape(s)}>{t(`media.shape.${s.key}`)}</button>
							))}
						</div>
					</div>

					<div className="hk-field">
						<span className="hk-label">{t('media.editSize')}</span>
						<div className="hk-chiprow">
							{SIZES.map((s) => (
								<button key={s.key} type="button" aria-pressed={size.key === s.key}
									className={`hk-chip${size.key === s.key ? ' hk-on' : ''}`}
									onClick={() => setSize(s)}>
									{s.px ? t('media.sizePx', { px: s.px }) : t('media.sizeOriginal')}
								</button>
							))}
						</div>
					</div>
				</div>

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
