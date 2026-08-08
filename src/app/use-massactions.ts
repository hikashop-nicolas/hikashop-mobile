import { useCallback, useEffect, useState } from 'react';
import { useStores } from './store-context';
import { useDataChanged } from './data-changed';
import type { DataScope } from './data-changed';
import type { MassAction } from '../core';

// Which listing an action's table belongs to, so a run can say what it changed and anything
// showing those records reloads.
const SCOPE: Record<string, DataScope> = {
	product: 'products', order: 'orders', category: 'categories', discount: 'discounts', user: 'customers',
};

// Selecting rows in a listing so the shop's own bulk operations can be run over them.
//
// The app contributes the selection and nothing else: what an action does was decided in the
// backend, and the shop does the work. Nothing is offered where the shop has no actions for this
// listing, so a shop that has never made one sees no change at all.
export function useMassActions(table: string, resetKey: string) {
	const { client, active } = useStores();
	const changed = useDataChanged();
	const [actions, setActions] = useState<MassAction[]>([]);
	const [picking, setPicking] = useState(false);
	const [chosen, setChosen] = useState<Set<number>>(new Set());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [report, setReport] = useState<string[] | null>(null);

	// Not cached: an action added or unpublished in the backend should be right the next time the
	// listing is opened, and the list is a handful of rows.
	useEffect(() => {
		if (!client || !active) { setActions([]); return; }
		let alive = true;
		void client.getMassActions(table)
			.then((a) => { if (alive) setActions(a); })
			// Refused or unreachable simply means no bulk operations here.
			.catch(() => { if (alive) setActions([]); });
		return () => { alive = false; };
	}, [client, active, table]);

	// A different query is a different set of rows; a selection made against the old one means
	// nothing against the new.
	useEffect(() => { setChosen(new Set()); setPicking(false); setReport(null); setError(''); }, [resetKey]);

	const toggle = useCallback((id: number) => {
		setChosen((c) => {
			const next = new Set(c);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});
	}, []);

	const clear = useCallback(() => { setChosen(new Set()); setPicking(false); setReport(null); }, []);

	const run = useCallback(async (action: MassAction) => {
		if (!client || busy || chosen.size === 0) return;
		setBusy(true); setError(''); setReport(null);
		try {
			const res = await client.runMassAction(action.id, [...chosen]);
			setReport(res.report.length ? res.report : []);
			setChosen(new Set());
			setPicking(false);
			// The shop decided what changed and the app has no idea what, so the listing is
			// reloaded rather than patched.
			if (SCOPE[table]) changed.bump(SCOPE[table]);
			return res;
		} catch (e) {
			setError((e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string')
				? (e as { code: string }).code : 'generic');
		} finally {
			setBusy(false);
		}
	}, [client, busy, chosen, changed, table]);

	return {
		// Only worth offering when the shop actually has some.
		available: actions.length > 0,
		actions, picking, setPicking, chosen, toggle, clear, run, busy, error, report, setReport,
	};
}
