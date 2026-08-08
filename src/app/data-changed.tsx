import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

// A note that records of some kind have changed, so anything showing them reloads.
//
// It exists because of the split view: the list stays on screen while you edit a record beside
// it, so a change that alters how a row reads -- a name, a price, a status -- used to leave the
// list showing what it read before. Before the split there was no list to go stale, since editing
// replaced it.
//
// Deliberately coarse. A listing reloads its first page rather than trying to patch the one row,
// which would mean teaching every listing the shape of every edit, and would still be wrong for
// an edit that changes where the row sorts or whether it belongs in the current filter at all.
export type DataScope = 'products' | 'orders' | 'customers' | 'discounts' | 'categories';

interface DataChangedValue {
	bump: (scope: DataScope) => void;
	version: (scope: DataScope) => number;
}

const DataChangedContext = createContext<DataChangedValue | null>(null);

export function DataChangedProvider({ children }: { children: ReactNode }) {
	const [versions, setVersions] = useState<Partial<Record<DataScope, number>>>({});

	const bump = useCallback((scope: DataScope) => {
		setVersions((v) => ({ ...v, [scope]: (v[scope] ?? 0) + 1 }));
	}, []);

	const value = useMemo<DataChangedValue>(() => ({
		bump,
		version: (scope: DataScope) => versions[scope] ?? 0,
	}), [bump, versions]);

	return <DataChangedContext.Provider value={value}>{children}</DataChangedContext.Provider>;
}

export function useDataChanged(): DataChangedValue {
	// Outside the provider nothing is listening, which is fine: a screen that reports a change
	// should not fail because nothing happens to be showing a list of them.
	return useContext(DataChangedContext) ?? { bump: () => {}, version: () => 0 };
}
