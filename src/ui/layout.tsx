import type { ReactNode } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';

export function Screen({ title, left, right, children, center }: {
	title?: ReactNode;
	left?: ReactNode;
	right?: ReactNode;
	children: ReactNode;
	center?: boolean;
}) {
	const hasBar = title || left || right;
	return (
		<>
			{hasBar && (
				<header className="hk-appbar">
					{left}
					{title && <div className="hk-title">{title}</div>}
					<div className="hk-grow" />
					{right}
				</header>
			)}
			<main className={`hk-body${center ? ' hk-center' : ''}`}>{children}</main>
		</>
	);
}

// A centered overlay dialog. Clicking the backdrop or the close button dismisses it.
export function Modal({ title, onClose, footer, children }: {
	title?: ReactNode;
	onClose: () => void;
	footer?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="hk-modal-backdrop" onClick={onClose} role="presentation">
			<div className="hk-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
				<header className="hk-modal-head">
					{title && <div className="hk-modal-title">{title}</div>}
					<button type="button" className="hk-iconbtn" onClick={onClose} aria-label="close"><Icon name="close" size={22} /></button>
				</header>
				<div className="hk-modal-body">{children}</div>
				{footer && <footer className="hk-modal-foot">{footer}</footer>}
			</div>
		</div>
	);
}

export interface TabDef {
	key: string;
	label: string;
	icon: IconName;
}

export function TabBar({ tabs, active, onSelect }: { tabs: TabDef[]; active: string; onSelect: (key: string) => void }) {
	return (
		<nav className="hk-tabbar">
			{tabs.map((t) => (
				<button key={t.key} className={`hk-tab${t.key === active ? ' hk-on' : ''}`} onClick={() => onSelect(t.key)}>
					<span className="hk-tab-ic"><Icon name={t.icon} size={22} /></span>
					{t.label}
				</button>
			))}
		</nav>
	);
}
