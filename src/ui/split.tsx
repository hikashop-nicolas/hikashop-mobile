import { useEffect, useState } from 'react';
import { useOutlet, useNavigate } from 'react-router-dom';
import type { MouseEvent, ReactNode } from 'react';
import { useUnsaved } from '../app/unsaved';

// Both panes fit side by side from here up. Kept in step with the same value in ui.css.
const SPLIT_QUERY = '(min-width: 1100px)';

export function useIsSplit(): boolean {
	const [split, setSplit] = useState(
		() => typeof window !== 'undefined' && window.matchMedia(SPLIT_QUERY).matches,
	);
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia(SPLIT_QUERY);
		const onChange = () => setSplit(mq.matches);
		onChange();
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	}, []);
	return split;
}

// List and detail, side by side once there is room for both.
//
// The routes are unchanged -- the detail is a child route, so its URL, the links to it and its
// back button all stay as they were.
//
// Only what is on screen is rendered, never a hidden copy. Three cases:
//   nothing open        -> the list has the screen, as it did before the split existed. Holding
//                          half the width for a "pick something" placeholder would waste exactly
//                          the room this layout was meant to use.
//   open, narrow        -> the detail replaces the list, which is how a phone has always behaved.
//   open, wide          -> both, so the list keeps its place and its scroll position while you
//                          move between rows. On a laptop, going back to the list to open the
//                          next order is the thing you do most often.
export function SplitView({ list }: { list: ReactNode }) {
	const outlet = useOutlet();
	const split = useIsSplit();
	const unsaved = useUnsaved();
	const nav = useNavigate();

	// Opening another row replaces what is in the detail pane, so it has to ask first when that
	// would throw away edits. Caught on the way down, before the link acts on it.
	function onListClick(e: MouseEvent<HTMLDivElement>) {
		if (!unsaved.isDirty()) return;
		const link = (e.target as HTMLElement).closest?.('a[href]');
		if (!link) return;
		const href = link.getAttribute('href') ?? '';
		const to = href.startsWith('#') ? href.slice(1) : href;
		if (!to.startsWith('/')) return; // an outside link is not ours to intercept
		e.preventDefault();
		e.stopPropagation();
		unsaved.ask(() => { unsaved.setDirty(false); nav(to); });
	}

	if (!outlet) return <>{list}</>;
	if (!split) return <>{outlet}</>;

	return (
		<div className="hk-split">
			<div className="hk-split-list" onClickCapture={onListClick}>{list}</div>
			<div className="hk-split-detail">{outlet}</div>
		</div>
	);
}
