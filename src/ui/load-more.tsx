import { useEffect, useRef } from 'react';
import { Spinner } from './atoms';
import { useT } from '../i18n';

// The foot of a listing: how much of it you are looking at, and the way to see more.
//
// It loads the next page when it scrolls into view, so on a phone you just keep scrolling. The
// button is not a fallback for that: it is what a keyboard or screen-reader user reaches, since
// neither of those necessarily scrolls the sentinel into view, and it also gives a way to retry
// when a page fails to load.
export function LoadMore({ shown, total, hasMore, loading, error, onLoad }: {
	shown: number;
	total: number;
	hasMore: boolean;
	loading: boolean;
	error?: string;
	onLoad: () => void;
}) {
	const t = useT();
	const ref = useRef<HTMLDivElement | null>(null);
	// Keep the callback out of the effect's deps: it changes identity on every page.
	const onLoadRef = useRef(onLoad);
	onLoadRef.current = onLoad;

	useEffect(() => {
		const el = ref.current;
		// Don't auto-load after a failure: it would retry in a tight loop against a failing
		// endpoint for as long as the foot stays on screen.
		if (!el || !hasMore || loading || error) return;
		if (typeof IntersectionObserver === 'undefined') return;
		const io = new IntersectionObserver((entries) => {
			if (entries.some((e) => e.isIntersecting)) onLoadRef.current();
		}, { rootMargin: '200px' });
		io.observe(el);
		return () => io.disconnect();
	}, [hasMore, loading, error]);

	return (
		<div className="hk-listfoot" ref={ref}>
			{error && <div className="hk-error-note">{t('list.loadMoreFailed')}</div>}
			{hasMore && (
				loading
					? <Spinner />
					: <button type="button" className="hk-btn hk-btn--sm" onClick={onLoad}>{t('list.loadMore')}</button>
			)}
			<div className="hk-muted">{t('list.countOf', { shown, total })}</div>
		</div>
	);
}
