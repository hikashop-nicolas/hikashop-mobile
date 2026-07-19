import type { ReactNode } from 'react';

// A small, consistent line-icon set. All icons are drawn on a 24x24 grid, stroked with
// currentColor so they inherit text colour, and share one stroke weight and round joins.

export type IconName = 'dashboard' | 'orders' | 'store' | 'search' | 'plus' | 'back' | 'scan' | 'bell';

const PATHS: Record<IconName, ReactNode> = {
	dashboard: (
		<>
			<rect x="3" y="3" width="7" height="7" rx="1.5" />
			<rect x="14" y="3" width="7" height="7" rx="1.5" />
			<rect x="3" y="14" width="7" height="7" rx="1.5" />
			<rect x="14" y="14" width="7" height="7" rx="1.5" />
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
};

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
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
			className={className}
			aria-hidden="true"
			focusable="false"
		>
			{PATHS[name]}
		</svg>
	);
}
