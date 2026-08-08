import { useEffect, useRef, useState } from 'react';
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
// How long a record takes to open or close. Half a second: it is the larger of the two moves the
// app makes, and the one worth showing properly.
const DETAIL_MS = 500;

export function SplitView({ list }: { list: ReactNode }) {
	const outlet = useOutlet();
	const split = useIsSplit();
	const unsaved = useUnsaved();
	const nav = useNavigate();

	// Closing has to be the reverse of opening, not a disappearance, so the record stays on screen
	// for as long as it takes to slide away. The last one rendered is held rather than copied, so
	// what slides out is the screen you were just looking at.
	const last = useRef<ReactNode>(null);
	if (outlet) last.current = outlet;
	const open = !!outlet;
	const [closing, setClosing] = useState(false);
	useEffect(() => {
		if (open) { setClosing(false); return; }
		if (!last.current) return;
		setClosing(true);
		const t = setTimeout(() => { last.current = null; setClosing(false); }, DETAIL_MS);
		return () => clearTimeout(t);
	}, [open]);

	const detail = outlet ?? (closing ? last.current : null);
	const motion = closing ? ' hk-detail--out' : ' hk-detail--in';

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

	// Narrow: the record covers the list rather than replacing it, so it can slide over and back
	// off. The list stays mounted underneath, which also means it keeps its place in the page.
	//
	// Covered, it is inert: out of the tab order, unreachable by a screen reader and not a target
	// for a click. Something you cannot see should not be something you can land on.
	if (!split) {
		return (
			<div className="hk-stack">
				<div className="hk-stack-under" inert={detail ? true : undefined}>{list}</div>
				{detail && <div className="hk-detail-over"><div className={`hk-slide${motion}`}>{detail}</div></div>}
			</div>
		);
	}

	// Wide: the list gives up its width as the record arrives, and takes it back as it leaves.
	// The width is driven by whether a record is really open, not by whether one is still on
	// screen, so the two happen together on the way out as well as on the way in.
	return (
		<div className={`hk-split${open ? ' hk-split--open' : ''}`}>
			<div className="hk-split-list" onClickCapture={onListClick}>{list}</div>
			{/* The pane is placed; what slides is its contents, clipped by the pane. Sliding the
			    pane itself would reach past the split and make it scrollable sideways. */}
			{detail && <div className="hk-split-detail"><div className={`hk-slide${motion}`}>{detail}</div></div>}
		</div>
	);
}
