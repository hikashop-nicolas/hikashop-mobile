import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import { Cropt } from 'cropt';
import 'cropt/src/cropt.css';
import { Spinner } from '../ui';
import { useT } from '../i18n';

// Crop and rotate an image before it is attached.
//
// A pane rather than a dialog: it slides in beside the media browser, the way a record opens
// beside a listing everywhere else in the app. A second dialog over the first would have been
// two overlays deep for one picture.
//
// The result is always a new file. The library image it came from may be attached to other
// products, and quietly changing what those show is not what somebody cropping a picture is
// asking for.
//
// Cropt (MIT, no dependencies) does the interaction: drag to move, scroll or pinch to zoom, the
// handles to set any shape, the buttons to rotate. What comes out is what was cropped, at the
// resolution it was cropped from; the shop's own image settings resize it on upload as they do
// for every other picture.
export type ImageEditorHandle = { save: () => Promise<Blob> };

export function ImageEditor({ src, ref, onReady }: {
	/** An object URL, so the pixels are same-origin and the canvas can be read. */
	src: string;
	ref?: Ref<ImageEditorHandle>;
	onReady?: (ready: boolean) => void;
}) {
	const t = useT();
	const host = useRef<HTMLDivElement>(null);
	const cropt = useRef<Cropt | null>(null);
	const [ready, setReady] = useState(false);
	const [err, setErr] = useState('');

	useImperativeHandle(ref, () => ({
		save: async () => {
			const c = cropt.current;
			if (!c) throw new Error('not ready');
			return await c.toBlob(null, 'image/jpeg', 0.9);
		},
	}), []);

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
		void c.bind(src)
			.then(() => { if (alive) { setReady(true); onReady?.(true); } })
			.catch(() => { if (alive) setErr(t('media.editFailed')); });
		return () => { alive = false; onReady?.(false); c.destroy(); cropt.current = null; };
		// onReady is a callback prop; re-binding the image because its identity changed would
		// throw away the crop in progress.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [src, t]);

	return (
		<div className="hk-imgedit">
			<div ref={host} className="hk-imgedit-stage" />
			{!ready && !err && <div className="hk-center-col"><Spinner /></div>}
			<p className="hk-hint">{t('media.editHint')}</p>
			{err && <div className="hk-error-note">{err}</div>}
		</div>
	);
}

// "photo.png" cropped becomes "photo-edited.jpg": a new file, and one whose name says so. The
// output is a jpeg whatever went in, so the extension has to follow.
export function editedName(name: string): string {
	const dot = name.lastIndexOf('.');
	const stem = dot > 0 ? name.slice(0, dot) : name;
	return `${stem}-edited.jpg`;
}
