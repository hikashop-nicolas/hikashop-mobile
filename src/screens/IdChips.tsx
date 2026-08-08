import { useEffect, useRef, useState } from 'react';
import { Field, Icon } from '../ui';
import { useT } from '../i18n';
import { SearchPicker } from './SearchPicker';
import type { PickItem } from './SearchPicker';

// A set of ids shown as removable chips, with a search picker to add more. The label for an id
// already stored has to be looked up, so `resolve` fetches names for a list of ids; results are
// remembered for the life of the component, and an id with no name shows as #id rather than
// vanishing.
export function IdChips({ label, hint, ids, search, resolve, searchTitle, searchPlaceholder, minChars = 0, onChange }: {
	label: string;
	hint?: string;
	ids: number[];
	search: (q: string) => Promise<PickItem[]>;
	resolve: (ids: number[]) => Promise<PickItem[]>;
	searchTitle: string;
	searchPlaceholder?: string;
	minChars?: number;
	onChange: (ids: number[]) => void;
}) {
	const t = useT();
	const [names, setNames] = useState<Record<number, string>>({});
	const [picking, setPicking] = useState(false);
	// Keep the callbacks out of the effect's deps: callers pass fresh closures every render.
	const resolveRef = useRef(resolve);
	resolveRef.current = resolve;

	useEffect(() => {
		const missing = ids.filter((id) => names[id] === undefined);
		if (missing.length === 0) return;
		let alive = true;
		void (async () => {
			try {
				const items = await resolveRef.current(missing);
				if (!alive) return;
				setNames((n) => {
					const next = { ...n };
					for (const it of items) next[it.id] = it.label;
					// Anything the store no longer knows about still needs a stable label.
					for (const id of missing) if (next[id] === undefined) next[id] = `#${id}`;
					return next;
				});
			} catch {
				if (alive) setNames((n) => ({ ...n, ...Object.fromEntries(missing.map((id) => [id, `#${id}`])) }));
			}
		})();
		return () => { alive = false; };
	}, [ids, names]);

	return (
		<Field label={label} hint={hint}>
			<div className="hk-chip-row">
				{ids.map((id) => (
					<button key={id} type="button" className="hk-chip hk-on" onClick={() => onChange(ids.filter((x) => x !== id))}>
						{names[id] ?? `#${id}`} <Icon name="close" size={12} />
					</button>
				))}
				<button type="button" className="hk-chip" onClick={() => setPicking(true)}>
					<Icon name="plus" size={13} /> {t('common.add')}
				</button>
			</div>
			{picking && (
				<SearchPicker
					title={searchTitle}
					placeholder={searchPlaceholder}
					minChars={minChars}
					excludeIds={ids}
					search={search}
					onClose={() => setPicking(false)}
					onPick={(item) => {
						setNames((n) => ({ ...n, [item.id]: item.label }));
						onChange([...ids, item.id]);
						setPicking(false);
					}}
				/>
			)}
		</Field>
	);
}
