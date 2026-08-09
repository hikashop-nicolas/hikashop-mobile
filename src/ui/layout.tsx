import { useEffect, useId, useRef } from 'react';
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';
import { useT } from '../i18n';

export function Screen({ title, left, right, children, center, scrollResetKey }: {
	title?: ReactNode;
	left?: ReactNode;
	right?: ReactNode;
	children: ReactNode;
	center?: boolean;
	// Change this when the content becomes a different list -- a new search or filter -- and the
	// body returns to the top. Otherwise you keep the scroll position of a list you have left,
	// which after a filter that returns fewer rows leaves you somewhere arbitrary in the new one.
	scrollResetKey?: string | number;
}) {
	const hasBar = title || left || right;
	const bodyRef = useRef<HTMLElement | null>(null);
	useEffect(() => {
		if (scrollResetKey === undefined) return;
		bodyRef.current?.scrollTo({ top: 0 });
	}, [scrollResetKey]);
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
			<main className={`hk-body${center ? ' hk-center' : ''}`} ref={bodyRef}>{children}</main>
		</>
	);
}

// What a keyboard can land on inside the dialog.
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A centered overlay dialog. Clicking the backdrop or the close button dismisses it, and so
// does Escape.
//
// Focus is kept inside while it is open and put back where it came from when it closes.
// aria-modal hides the page behind it from a screen reader, but it does nothing about the tab
// key, so without the trap a keyboard walks straight out of the dialog into a page it cannot
// see.
export function Modal({ title, onClose, footer, children }: {
	title?: ReactNode;
	onClose: () => void;
	footer?: ReactNode;
	children: ReactNode;
}) {
	const t = useT();
	const titleId = useId();
	const box = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const opener = document.activeElement as HTMLElement | null;
		const first = box.current?.querySelector<HTMLElement>(FOCUSABLE);
		(first ?? box.current)?.focus();
		return () => opener?.focus?.();
	}, []);

	function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
		if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
		if (e.key !== 'Tab') return;
		const items = [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
			.filter((el) => el.offsetParent !== null || el === document.activeElement);
		if (!items.length) return;
		const first = items[0];
		const last = items[items.length - 1];
		if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
		else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
	}

	return (
		<div className="hk-modal-backdrop" onClick={onClose} role="presentation">
			<div
				ref={box}
				className="hk-modal"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={onKeyDown}
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? titleId : undefined}
				tabIndex={-1}
			>
				<header className="hk-modal-head">
					{title && <div className="hk-modal-title" id={titleId}>{title}</div>}
					<button type="button" className="hk-iconbtn" onClick={onClose} aria-label={t('common.close')}><Icon name="close" size={22} /></button>
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
				// Icons only: at phone width five labels sit too close together to read, and each one
				// repeats what its icon already says. The label stays in the markup for screen
				// readers and as the accessible name, it is just not painted.
				<button
					key={t.key}
					className={`hk-tab${t.key === active ? ' hk-on' : ''}`}
					onClick={() => onSelect(t.key)}
					aria-label={t.label}
					aria-current={t.key === active ? 'page' : undefined}>
					<span className="hk-tab-ic"><Icon name={t.icon} size={24} /></span>
					<span className="hk-sr-only">{t.label}</span>
				</button>
			))}
		</nav>
	);
}
