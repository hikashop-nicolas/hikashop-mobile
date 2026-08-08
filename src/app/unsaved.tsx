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
}

const UnsavedContext = createContext<UnsavedValue | null>(null);

export function UnsavedProvider({ children }: { children: ReactNode }) {
	const dirty = useRef(false);
	const value = useMemo<UnsavedValue>(() => ({
		setDirty: (d: boolean) => { dirty.current = d; },
		isDirty: () => dirty.current,
	}), []);
	return <UnsavedContext.Provider value={value}>{children}</UnsavedContext.Provider>;
}

export function useUnsaved(): UnsavedValue {
	// A form outside the provider simply has nothing watching it, which is better than throwing:
	// the guard is a courtesy, not something the form depends on to work.
	const ctx = useContext(UnsavedContext);
	const fallback = useRef<UnsavedValue>({ setDirty: () => {}, isDirty: () => false });
	return ctx ?? fallback.current;
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
