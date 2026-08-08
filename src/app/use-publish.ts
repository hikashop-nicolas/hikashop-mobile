import { useCallback, useEffect, useState } from 'react';

// Publishing a row from the listing it appears in.
//
// The flip shows immediately and the request follows, because the answer to "is this on sale?"
// should not take a round trip; a failure puts the row back as it was and says why.
//
// The new value is held here rather than pushed into the listing, which cannot be patched: a
// listing reloads its first page when its records change, and that would throw away every further
// page somebody had scrolled through to reach the row they just toggled. The override is dropped
// when the query changes, since that reloads the rows from the shop anyway.
export function usePublish<T extends { id: number; published: boolean }>(params: {
	save: (row: T, published: boolean) => Promise<unknown>;
	// Changing this clears what is remembered here: a different query is a different set of rows.
	resetKey: string;
}) {
	const { save, resetKey } = params;
	const [value, setValue] = useState<Record<number, boolean>>({});
	const [busy, setBusy] = useState<Record<number, boolean>>({});
	const [error, setError] = useState('');

	useEffect(() => { setValue({}); setBusy({}); setError(''); }, [resetKey]);

	const isPublished = useCallback((row: T) => value[row.id] ?? row.published, [value]);

	const toggle = useCallback((row: T) => {
		const next = !(value[row.id] ?? row.published);
		setError('');
		setValue((v) => ({ ...v, [row.id]: next }));
		setBusy((b) => ({ ...b, [row.id]: true }));
		void save(row, next)
			.catch((e) => {
				// Put the row back: what is on screen has to be what the shop holds.
				setValue((v) => ({ ...v, [row.id]: !next }));
				setError((e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string')
					? (e as { code: string }).code : 'generic');
			})
			.finally(() => setBusy((b) => {
				const rest = { ...b };
				delete rest[row.id];
				return rest;
			}));
	}, [save, value]);

	return { isPublished, toggle, busy, error };
}
