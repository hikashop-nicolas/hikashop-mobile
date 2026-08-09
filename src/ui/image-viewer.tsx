import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import { Icon } from './icons';

export interface ViewableImage {
	url: string;
	label?: string;
}

// A photograph shown at the size the screen allows, so it can actually be checked rather than
// guessed at from an 84px thumbnail. Where several images belong together (a product's) the whole
// set is passed and the viewer steps through them, since the reason to open one is usually to
// compare it with the next.
export function ImageViewer({ images, start = 0, onClose }: {
	images: ViewableImage[];
	start?: number;
	onClose: () => void;
}) {
	const t = useT();
	const [at, setAt] = useState(() => Math.min(Math.max(start, 0), Math.max(images.length - 1, 0)));
	const count = images.length;

	const step = useCallback((by: number) => {
		setAt((i) => (count === 0 ? 0 : (i + by + count) % count));
	}, [count]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') onClose();
			else if (e.key === 'ArrowRight') step(1);
			else if (e.key === 'ArrowLeft') step(-1);
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose, step]);

	const current = images[at];
	if (!current) return null;

	// Into the body, like every other overlay: the panes animate with transforms, and a
	// transformed ancestor is the containing block for position: fixed, so a viewer written
	// inside the record pane covered the record pane instead of the page.
	return createPortal(
		<div className="hk-viewer" role="dialog" aria-modal="true" aria-label={t('media.viewImage')} onClick={onClose}>
			<button type="button" className="hk-viewer-close" aria-label={t('common.close')}
				onClick={onClose}><Icon name="close" size={24} /></button>

			{count > 1 && (
				<button type="button" className="hk-viewer-nav hk-viewer-prev" aria-label={t('media.previousImage')}
					onClick={(e) => { e.stopPropagation(); step(-1); }}><Icon name="chevron" size={28} className="hk-rot180" /></button>
			)}

			{/* Clicking the picture itself must not dismiss: only the surrounding dark does. */}
			<img className="hk-viewer-img" src={current.url} alt={current.label ?? ''} onClick={(e) => e.stopPropagation()} />

			{count > 1 && (
				<button type="button" className="hk-viewer-nav hk-viewer-next" aria-label={t('media.nextImage')}
					onClick={(e) => { e.stopPropagation(); step(1); }}><Icon name="chevron" size={28} /></button>
			)}

			<div className="hk-viewer-foot" onClick={(e) => e.stopPropagation()}>
				{current.label && <span className="hk-viewer-name">{current.label}</span>}
				{count > 1 && <span className="hk-viewer-count">{t('media.imageOf', { shown: at + 1, total: count })}</span>}
			</div>
		</div>,
		document.body,
	);
}
