import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';

// Whether the form currently on screen has changes that have not been saved.
//
// Kept outside the form so the things that navigate away from it -- the list beside it in a split
// view -- can ask before throwing the changes away. It is a ref rather than state on purpose: the
// answer is only ever read at the moment of a click, and making it state would re-render every
// screen on every keystroke.
interface UnsavedValue {
	setDirty: (dirty: boolean) => void;
	isDirty: () => boolean;
	// What to ask about, when something has asked. Set by whoever holds the confirmation UI.
	ask: (leave: () => void) => void;
	setAsker: (fn: ((leave: () => void) => void) | null) => void;
}

const UnsavedContext = createContext<UnsavedValue | null>(null);

export function UnsavedProvider({ children }: { children: ReactNode }) {
	const dirty = useRef(false);
	const asker = useRef<((leave: () => void) => void) | null>(null);
	const value = useMemo<UnsavedValue>(() => ({
		setDirty: (d: boolean) => { dirty.current = d; },
		isDirty: () => dirty.current,
		// With nothing able to ask, leaving goes ahead: a missing prompt must not trap someone
		// on a screen they are trying to leave.
		ask: (leave: () => void) => { if (asker.current) asker.current(leave); else leave(); },
		setAsker: (fn) => { asker.current = fn; },
	}), []);
	return <UnsavedContext.Provider value={value}>{children}</UnsavedContext.Provider>;
}

export function useUnsaved(): UnsavedValue {
	// A form outside the provider simply has nothing watching it, which is better than throwing:
	// the guard is a courtesy, not something the form depends on to work.
	const ctx = useContext(UnsavedContext);
	const fallback = useRef<UnsavedValue>({
		setDirty: () => {}, isDirty: () => false,
		ask: (leave: () => void) => leave(), setAsker: () => {},
	});
	return ctx ?? fallback.current;
}

// For a control that leaves the form -- a back button -- so it asks first when there is
// something to lose, and simply goes when there is not.
export function useConfirmLeave(): (leave: () => void) => void {
	const { isDirty, ask } = useUnsaved();
	return useCallback((leave: () => void) => {
		if (!isDirty()) { leave(); return; }
		ask(leave);
	}, [isDirty, ask]);
}

// Called by an edit form with whether it currently holds unsaved changes. Clears the flag when
// the form goes away, so a screen that is no longer on display never blocks anything.
export function useUnsavedChanges(dirty: boolean): void {
	const { setDirty } = useUnsaved();
	const set = useCallback(setDirty, [setDirty]);
	useEffect(() => {
		set(dirty);
		return () => set(false);
	}, [dirty, set]);
}
