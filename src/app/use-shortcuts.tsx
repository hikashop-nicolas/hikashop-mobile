import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShortcutMatcher, isTyping, SHORTCUTS } from './shortcuts';
import type { ShortcutContext } from './shortcuts';

const Ctx = createContext<{ helpOpen: boolean; setHelpOpen: (v: boolean) => void }>({
	helpOpen: false,
	setHelpOpen: () => {},
});

export function ShortcutProvider({ children }: { children: ReactNode }) {
	const nav = useNavigate();
	const [helpOpen, setHelpOpen] = useState(false);

	const ctx: ShortcutContext = useMemo(() => ({
		navigate: (to) => nav(to),
		// The screen on show owns these, so they are found where they are rather than registered
		// by every listing. Both hooks are on the shared atoms, so a new screen gets them free.
		focusSearch: () => document.querySelector<HTMLInputElement>('[data-hk-search]')?.focus(),
		createNew: () => document.querySelector<HTMLButtonElement>('[data-hk-new]')?.click(),
		close: () => {
			// Escape closes the help first, then whatever record is open. A modal handles its own
			// Escape and stops it before it reaches here.
			setHelpOpen((open) => {
				if (open) return false;
				const back = document.querySelector<HTMLElement>('.hk-detail-over .hk-appbar button, .hk-split-detail .hk-appbar button');
				back?.click();
				return false;
			});
		},
		toggleHelp: () => setHelpOpen((v) => !v),
	}), [nav]);

	useEffect(() => {
		const matcher = new ShortcutMatcher();
		function onKey(e: KeyboardEvent) {
			if (e.defaultPrevented) return;

			// The one modifier binding, and the only way to reach a shortcut while the caret is in
			// a field. Chrome puts the address bar on Cmd/Ctrl+K, but a page may take it, and every
			// app people already use for this does.
			if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				setHelpOpen((v) => !v);
				return;
			}

			// A plain shortcut must never eat a keystroke meant for a field, and must never fight a
			// browser or OS binding.
			if (e.metaKey || e.ctrlKey || e.altKey) return;
			if (e.key !== 'Escape' && isTyping(e.target)) return;

			const hit = matcher.press(e.key);
			if (!hit) return;
			// Escape with nothing open should still reach the browser.
			if (hit.keys === 'Escape' && !helpOpen && !document.querySelector('.hk-detail-over, .hk-split-detail')) return;
			e.preventDefault();
			hit.run(ctx);
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [ctx, helpOpen]);

	return <Ctx.Provider value={{ helpOpen, setHelpOpen }}>{children}</Ctx.Provider>;
}

export function useShortcutHelp() {
	const { helpOpen, setHelpOpen } = useContext(Ctx);
	return { helpOpen, setHelpOpen, shortcuts: SHORTCUTS };
}
