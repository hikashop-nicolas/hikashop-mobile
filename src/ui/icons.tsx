import type { ReactNode } from 'react';

// A small, consistent line-icon set. All icons are drawn on a 24x24 grid, stroked with
// currentColor so they inherit text colour, and share one stroke weight and round joins.

export type IconName = 'dashboard' | 'orders' | 'store' | 'search' | 'plus' | 'back' | 'scan' | 'bell' | 'products' | 'chevron' | 'check' | 'close' | 'categories' | 'trash' | 'edit' | 'customers' | 'discount' | 'trendUp' | 'trendDown' | 'eye' | 'upload' | 'image' | 'play' | 'translate' | 'save';

const PATHS: Record<IconName, ReactNode> = {
	discount: (
		<>
			<path d="M3 12l8.5-8.5a2 2 0 0 1 1.4-.6H20a1 1 0 0 1 1 1v6.6a2 2 0 0 1-.6 1.4L12 21a2 2 0 0 1-2.8 0L3 14.8a2 2 0 0 1 0-2.8z" />
			<circle cx="16.5" cy="7.5" r="1.2" />
		</>
	),
	customers: (
		<>
			<circle cx="9" cy="8" r="3.2" />
			<path d="M3.5 20c0-3 2.4-5 5.5-5s5.5 2 5.5 5" />
			<path d="M16 5.4a3 3 0 0 1 0 5.6" />
			<path d="M17.6 20c0-2.3-1-4-2.6-4.7" />
		</>
	),
	// A trend line: up, down, up, with the arrow head on the rise it ends on. The shop's takings
	// over time is what the dashboard is, which four tiles said nothing about.
	dashboard: (
		<>
			<path d="M3 20h18" />
			<path d="M5 15.5l4.5-5 3.5 3.5L20 6" />
			<path d="M15.5 6H20v4.5" />
		</>
	),
	orders: (
		<>
			<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V3.5z" />
			<path d="M9 8h6" />
			<path d="M9 11.5h6" />
		</>
	),
	store: (
		<>
			<path d="M4 9l2-5h12l2 5" />
			<path d="M3 9h18" />
			<path d="M5 9v11h14V9" />
			<path d="M10 20v-5h4v5" />
		</>
	),
	search: (
		<>
			<circle cx="11" cy="11" r="7" />
			<path d="M21 21l-4.3-4.3" />
		</>
	),
	plus: (
		<>
			<path d="M12 5v14" />
			<path d="M5 12h14" />
		</>
	),
	back: <path d="M15 6l-6 6 6 6" />,
	scan: (
		<>
			<path d="M4 8V6a2 2 0 0 1 2-2h2" />
			<path d="M16 4h2a2 2 0 0 1 2 2v2" />
			<path d="M20 16v2a2 2 0 0 1-2 2h-2" />
			<path d="M8 20H6a2 2 0 0 1-2-2v-2" />
			<path d="M7 12h10" />
		</>
	),
	bell: (
		<>
			<path d="M18 9a6 6 0 0 0-12 0c0 6-2 8-2 8h16s-2-2-2-8z" />
			<path d="M10.5 20a2 2 0 0 0 3 0" />
		</>
	),
	products: (
		<>
			<path d="M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5v-9z" />
			<path d="M3 7.5l9 4.5 9-4.5" />
			<path d="M12 12v9" />
		</>
	),
	categories: (
		<>
			<path d="M3 5.5h6l1.5 2H21v11H3z" />
			<path d="M3 9.5h18" />
		</>
	),
	trash: (
		<>
			<path d="M4 7h16" />
			<path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
			<path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
			<path d="M10 11v6M14 11v6" />
		</>
	),
	edit: (
		<>
			<path d="M4 20h4l10-10-4-4L4 16z" />
			<path d="M13.5 6.5l4 4" />
		</>
	),
	// Two scripts side by side: 文 and a Latin A. The character's own geometry, drawn across the
	// full box rather than squeezed into a third of it: the bar, the dot above it, and the two
	// strokes that cross below. Drawn any smaller, the crossing closes up and it reads as a
	// character with a piece missing.
	translate: (
		<>
			<path d="M2 5h12" />
			<path d="M7 2h1" />
			<path d="M5 8l6 6" />
			<path d="M4 14l6-6 2-3" />
			<path d="M22 22l-5-10-5 10" />
			<path d="M14 18h6" />
		</>
	),
	// A floppy disk: the shutter above, the label below, and the corner the sleeve cut off.
	save: (
		<>
			<path d="M6 4.5h9.3L19.5 8.7V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5z" />
			<path d="M8.7 4.5v4h6V4.5" />
			<path d="M8.2 19.5v-4.8h7.6v4.8" />
		</>
	),
	chevron: <path d="M9 6l6 6-6 6" />,
	upload: (
		<>
			<path d="M12 16V4" />
			<path d="M8 8l4-4 4 4" />
			<path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
		</>
	),
	image: (
		<>
			<rect x="3" y="4.5" width="18" height="15" rx="2" />
			<circle cx="8.5" cy="10" r="1.6" />
			<path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 17" />
		</>
	),
	play: (
		<>
			<circle cx="12" cy="12" r="9" />
			<path d="M10 8.5l6 3.5-6 3.5z" />
		</>
	),
	eye: (
		<>
			<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
			<circle cx="12" cy="12" r="3" />
		</>
	),
	// Diagonal arrows for a trend: up to the right for a rise, down to the right for a fall.
	trendUp: <><path d="M5 18L18 5" /><path d="M9 5h9v9" /></>,
	trendDown: <><path d="M5 5l13 13" /><path d="M18 9v9H9" /></>,
	check: <path d="M5 12.5l4.5 4.5L19 7" />,
	close: (
		<>
			<path d="M6 6l12 12" />
			<path d="M18 6L6 18" />
		</>
	),
};

// Icons that point somewhere. In a right-to-left language "back" is to the right and a
// disclosure chevron opens the other way, so these are mirrored rather than left pointing at
// the wrong side of the screen.
const DIRECTIONAL = new Set<IconName>(['back', 'chevron']);

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
	const cls = [className, DIRECTIONAL.has(name) ? 'hk-ic-dir' : ''].filter(Boolean).join(' ') || undefined;
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.8}
			strokeLinecap="round"
			strokeLinejoin="round"
			className={cls}
			aria-hidden="true"
			focusable="false"
		>
			{PATHS[name]}
		</svg>
	);
}
