import { useCallback, useEffect, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT } from '../i18n';
import type { CategoryListItem } from '../core';
import { Modal, Field, Spinner, Icon } from '../ui';

const PAGE = 50;

// Pick categories (or manufacturers) without holding the tree in memory.
//
// The tree picker this replaces needed every category up front to render, which is fine until a
// shop has thousands of them. This one browses a level at a time, exactly as the category listing
// does, and searches the whole tree when you type. What is already selected is resolved by id, so
// showing a stored selection costs one request for those rows rather than the whole tree.
export function CategoryPicker({
	type, selected, onChange, multiple = true, searchPlaceholder, emptyLabel, onAddRequest, addLabel, excludeId,
}: {
	type: 'product' | 'manufacturer';
	selected: number[];
	onChange: (ids: number[]) => void;
	multiple?: boolean;
	searchPlaceholder?: string;
	emptyLabel?: string;
	onAddRequest?: () => void;
	addLabel?: string;
	// Hidden from the list. Used so a category cannot be offered as its own parent.
	excludeId?: number;
}) {
	const { client } = useStores();
	const t = useT();
	const [names, setNames] = useState<Record<number, string>>({});
	const [browsing, setBrowsing] = useState(false);

	// Resolve the names of whatever is already selected. An id the shop no longer knows keeps a
	// stable label rather than vanishing, so a selection is never silently dropped.
	useEffect(() => {
		if (!client) return;
		const missing = selected.filter((id) => names[id] === undefined);
		if (missing.length === 0) return;
		let alive = true;
		void client.listCategories({ type, ids: missing })
			.then((page) => {
				if (!alive) return;
				setNames((n) => {
					const next = { ...n };
					for (const c of page.items) next[c.id] = c.name;
					for (const id of missing) if (next[id] === undefined) next[id] = `#${id}`;
					return next;
				});
			})
			.catch(() => {
				if (alive) setNames((n) => ({ ...n, ...Object.fromEntries(missing.map((id) => [id, `#${id}`])) }));
			});
		return () => { alive = false; };
	}, [client, type, selected, names]);

	const pick = useCallback((c: CategoryListItem) => {
		setNames((n) => ({ ...n, [c.id]: c.name }));
		if (!multiple) {
			onChange([c.id]);
			setBrowsing(false);
			return;
		}
		onChange(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id]);
	}, [multiple, onChange, selected]);

	return (
		<>
			<div className="hk-chip-row">
				{selected.map((id) => (
					<button key={id} type="button" className="hk-chip hk-on" onClick={() => onChange(selected.filter((x) => x !== id))}>
						{names[id] ?? `#${id}`} <Icon name="close" size={12} />
					</button>
				))}
				<button type="button" className="hk-chip" onClick={() => setBrowsing(true)}>
					<Icon name="plus" size={13} /> {selected.length ? t('common.add') : t('categories.choose')}
				</button>
				{onAddRequest && (
					<button type="button" className="hk-chip" onClick={onAddRequest}>{addLabel ?? t('common.add')}</button>
				)}
			</div>
			{selected.length === 0 && emptyLabel && <div className="hk-muted">{emptyLabel}</div>}
			{browsing && (
				<BrowseModal
					type={type}
					selected={selected}
					multiple={multiple}
					searchPlaceholder={searchPlaceholder}
					excludeId={excludeId}
					onPick={pick}
					onClose={() => setBrowsing(false)}
				/>
			)}
		</>
	);
}

interface Level {
	items: CategoryListItem[];
	total: number;
	loading: boolean;
}

// One level at a time, with a trail of where you are. Typing searches the whole tree instead and
// shows flat results, each under the path it sits in -- a match can be anywhere, and showing them
// as a tree would list a matching child twice.
function BrowseModal({ type, selected, multiple, searchPlaceholder, excludeId, onPick, onClose }: {
	type: 'product' | 'manufacturer';
	selected: number[];
	multiple: boolean;
	searchPlaceholder?: string;
	excludeId?: number;
	onPick: (c: CategoryListItem) => void;
	onClose: () => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [trail, setTrail] = useState<{ id: number; name: string }[]>([]);
	const [search, setSearch] = useState('');
	const [level, setLevel] = useState<Level>({ items: [], total: 0, loading: true });

	const parentId = trail.length ? trail[trail.length - 1].id : 0;
	const searching = search.trim() !== '';

	const load = useCallback((from: number) => {
		if (!client) return;
		setLevel((l) => ({ ...l, loading: true }));
		client.listCategories({
			type,
			parent_id: searching ? undefined : (parentId || undefined),
			search: searching ? search.trim() : undefined,
			start: from,
			limit: PAGE,
		})
			.then((page) => setLevel((l) => ({
				items: from === 0 ? page.items : [...l.items, ...page.items],
				total: page.total,
				loading: false,
			})))
			.catch(() => setLevel((l) => ({ ...l, loading: false })));
	}, [client, type, parentId, search, searching]);

	// A new level or a new search starts from the top of that list.
	useEffect(() => {
		const id = setTimeout(() => load(0), searching ? 300 : 0);
		return () => clearTimeout(id);
	}, [load, searching]);

	return (
		<Modal title={t('categories.choose')} onClose={onClose}>
			<Field label="">
				<input
					className="hk-input"
					autoFocus
					value={search}
					placeholder={searchPlaceholder ?? t('categories.search')}
					onChange={(e) => setSearch(e.target.value)} />
			</Field>

			{!searching && (
				<div className="hk-crumbs">
					<button type="button" className="hk-linkbtn" onClick={() => setTrail([])}>{t('categories.allLevel')}</button>
					{trail.map((c, i) => (
						<span key={c.id}>
							<span className="hk-crumb-sep">›</span>
							<button type="button" className="hk-linkbtn" onClick={() => setTrail(trail.slice(0, i + 1))}>{c.name}</button>
						</span>
					))}
				</div>
			)}

			<div className="hk-picker-list">
				{level.items.filter((c) => c.id !== excludeId).map((c) => (
					<div key={c.id} className="hk-row">
						<button
							type="button"
							className="hk-row-grow hk-row-btn"
							onClick={() => onPick(c)}>
							<span className="hk-row-title">
								{multiple && <input type="checkbox" readOnly checked={selected.includes(c.id)} style={{ marginRight: 'var(--hk-s2)' }} />}
								{c.name}
							</span>
							{c.path && c.path.length > 0 && <span className="hk-row-sub">{c.path.map((p) => p.name).join(' › ')}</span>}
						</button>
						{!searching && c.has_children && (
							<button
								type="button"
								className="hk-iconbtn"
								aria-label={t('categories.openLevel', { name: c.name })}
								onClick={() => { setTrail([...trail, { id: c.id, name: c.name }]); }}>
								<Icon name="chevron" size={16} />
							</button>
						)}
					</div>
				))}
				{level.loading && <div className="hk-center-col"><Spinner /></div>}
				{!level.loading && level.items.length === 0 && <div className="hk-empty">{t('categories.noMatch')}</div>}
				{!level.loading && level.items.length < level.total && (
					<button type="button" className="hk-btn hk-btn--sm" onClick={() => load(level.items.length)}>
						{t('list.loadMore')}
					</button>
				)}
			</div>
			<div className="hk-muted" style={{ textAlign: 'center' }}>
				{t('list.countOf', { shown: level.items.length, total: level.total })}
			</div>
		</Modal>
	);
}
