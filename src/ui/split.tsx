import { useEffect, useState } from 'react';
import { useOutlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';

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
// back button all stay as they were, and on a phone this behaves exactly as before: the list is
// the whole screen, and opening a row replaces it with the detail.
//
// On a wide screen both panes are on screen at once, so the list keeps its place and its scroll
// position while you move between rows. That is the point of the layout: on a laptop, returning
// to the list to open the next order is the thing you do most often.
//
// The pane that is not on screen is not rendered at all, rather than hidden with CSS. On a phone
// the list would otherwise stay mounted behind an open detail, still holding its data and still
// re-fetching it on the poll, for a pane nobody can see.
export function SplitView({ list, icon, empty }: {
	list: ReactNode;
	// Shown in the detail pane on a wide screen while nothing is selected.
	icon: IconName;
	empty: string;
}) {
	const outlet = useOutlet();
	const split = useIsSplit();
	const showList = split || !outlet;

	return (
		<div className={`hk-split${outlet ? ' hk-split--detail' : ''}`}>
			{showList && <div className="hk-split-list">{list}</div>}
			{(split || outlet) && (
				<div className="hk-split-detail">
					{outlet ?? (
						<div className="hk-split-empty">
							<Icon name={icon} size={30} />
							<p>{empty}</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
