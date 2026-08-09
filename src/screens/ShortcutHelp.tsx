import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui';
import { useT } from '../i18n';
import { useShortcutHelp } from '../app/use-shortcuts';
import type { Shortcut } from '../app/shortcuts';

// The command palette, on Cmd/Ctrl+K or "?".
//
// It is a list of what the shortcuts do, and it runs them, which matters because Cmd/Ctrl+K is
// the only binding that works while the caret is in a field. Reaching a reference card from
// there and then having to close it and press two more keys would be no better than nothing.
export function ShortcutHelp() {
	const t = useT();
	const nav = useNavigate();
	const { helpOpen, setHelpOpen, shortcuts } = useShortcutHelp();
	const [query, setQuery] = useState('');
	const [at, setAt] = useState(0);
	const listRef = useRef<HTMLDivElement>(null);

	// Every opening starts clean, rather than resuming somebody's last search.
	useEffect(() => { if (helpOpen) { setQuery(''); setAt(0); } }, [helpOpen]);

	const matches = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return shortcuts;
		return shortcuts.filter((s) => t(s.label).toLowerCase().includes(q) || s.keys.includes(q));
	}, [query, shortcuts, t]);

	useEffect(() => { setAt((i) => Math.min(i, Math.max(0, matches.length - 1))); }, [matches.length]);

	if (!helpOpen) return null;

	function run(s: Shortcut) {
		setHelpOpen(false);
		// The palette is the thing being closed, so give it up before acting.
		queueMicrotask(() => s.run({
			navigate: (to) => nav(to),
			focusSearch: () => document.querySelector<HTMLInputElement>('[data-hk-search]')?.focus(),
			createNew: () => document.querySelector<HTMLButtonElement>('[data-hk-new]')?.click(),
			close: () => {},
			toggleHelp: () => setHelpOpen(true),
		}));
	}

	function onKeyDown(e: React.KeyboardEvent) {
		if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => (i + 1) % Math.max(1, matches.length)); }
		else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => (i - 1 + matches.length) % Math.max(1, matches.length)); }
		else if (e.key === 'Enter' && matches[at]) { e.preventDefault(); run(matches[at]); }
	}

	const groups: { key: Shortcut['group']; title: string }[] = [
		{ key: 'go', title: t('shortcut.groupGo') },
		{ key: 'act', title: t('shortcut.groupAct') },
		{ key: 'help', title: t('shortcut.groupHelp') },
	];

	return (
		<Modal title={t('shortcut.title')} onClose={() => setHelpOpen(false)}>
			<input
				className="hk-input"
				autoFocus
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				onKeyDown={onKeyDown}
				placeholder={t('shortcut.filter')}
				aria-label={t('shortcut.filter')}
				aria-controls="hk-palette"
				role="combobox"
				aria-expanded="true"
			/>
			<div id="hk-palette" ref={listRef} role="listbox" aria-label={t('shortcut.title')}>
				{matches.length === 0 && <p className="hk-keys-note">{t('shortcut.none')}</p>}
				{groups.map((g) => {
					const rows = matches.filter((s) => s.group === g.key);
					if (!rows.length) return null;
					return (
						<div key={g.key} className="hk-keys-group">
							<h3 className="hk-keys-title">{g.title}</h3>
							{rows.map((s) => {
								const i = matches.indexOf(s);
								return (
									<button
										type="button"
										key={s.keys}
										role="option"
										aria-selected={i === at}
										className={`hk-keys-row${i === at ? ' hk-on' : ''}`}
										onMouseEnter={() => setAt(i)}
										onClick={() => run(s)}
									>
										<span>{t(s.label)}</span>
										<span className="hk-keys">
											{s.keys.split(' ').map((k) => (
												<kbd key={k} className="hk-kbd">{k === 'Escape' ? 'Esc' : k}</kbd>
											))}
										</span>
									</button>
								);
							})}
						</div>
					);
				})}
			</div>
			<p className="hk-keys-note">{t('shortcut.note')}</p>
		</Modal>
	);
}
