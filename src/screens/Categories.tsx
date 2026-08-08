import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { usePaged } from '../app/use-paged';
import { useT, tError } from '../i18n';
import type { CategoryListItem } from '../core';
import { Screen, Spinner, NewButton, Search, Icon, LoadMore } from '../ui';

type Kind = 'product' | 'manufacturer';

// Rows per level. A level is usually short, so this is larger than a flat listing's page.
const PAGE = 50;

// What we know about one opened branch.
interface Branch {
	items: CategoryListItem[];
	total: number;
	loading: boolean;
	error: string;
}

// The category tree, fetched a level at a time.
//
// The whole tree used to arrive in one response and render as one flat list, which is fine for a
// demo shop and not for a real one: a few thousand categories would be a large download and a
// list nobody can scroll. Now the top level is paged like any other listing and a branch is
// fetched when it is opened.
//
// Searching cannot work level by level, since a match can be anywhere, so it queries the whole
// tree; each result carries its ancestors and is shown under them, so a match still says where
// it belongs instead of appearing as a name without context.
export function Categories() {
	const { client, active, cache } = useStores();
	const t = useT();
	const nav = useNavigate();
	const storeId = active?.id ?? '';
	const [kind, setKind] = useState<Kind>('product');
	const [search, setSearch] = useState('');
	const [branches, setBranches] = useState<Record<number, Branch>>({});

	const searching = search.trim() !== '';

	const top = usePaged<CategoryListItem>({
		enabled: !!client && !!active,
		// The cache holds the top level as a plain list; wrap it as a first page so the screen
		// paints instantly, and let the network fill in the real total a moment later. A cache
		// written by an earlier build can hold the whole tree, or already be page-shaped, so
		// take whichever is there rather than assuming.
		read: async () => {
			if (searching) return null;
			const c = await cache.getCategories(storeId, kind);
			if (!c) return null;
			const raw = c.data as unknown;
			const list = Array.isArray(raw)
				? raw as CategoryListItem[]
				: Array.isArray((raw as { items?: unknown })?.items)
					? (raw as { items: CategoryListItem[] }).items
					: [];
			return { ...c, data: { items: list, total: list.length, start: 0, limit: PAGE } };
		},
		fetch: (start) => client!.listCategories({
			type: kind,
			search: searching ? search.trim() : undefined,
			start,
			limit: PAGE,
		}),
		write: async (page) => { if (!searching) await cache.putCategories(storeId, kind, page.items); },
		deps: [storeId, kind, search.trim()],
		debounceMs: searching ? 300 : 0,
	});

	// Opening a branch loads its children; closing keeps them, so reopening is instant.
	const [open, setOpen] = useState<Set<number>>(new Set());

	const loadBranch = useCallback((id: number, from = 0) => {
		if (!client) return;
		setBranches((b) => ({ ...b, [id]: { items: b[id]?.items ?? [], total: b[id]?.total ?? 0, loading: true, error: '' } }));
		client.listCategories({ type: kind, parent_id: id, start: from, limit: PAGE })
			.then((page) => setBranches((b) => ({
				...b,
				[id]: {
					items: from === 0 ? page.items : [...(b[id]?.items ?? []), ...page.items],
					total: page.total,
					loading: false,
					error: '',
				},
			})))
			.catch((e) => setBranches((b) => ({
				...b,
				[id]: {
					items: b[id]?.items ?? [],
					total: b[id]?.total ?? 0,
					loading: false,
					error: (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string')
						? (e as { code: string }).code : 'generic',
				},
			})));
	}, [client, kind]);

	const toggle = useCallback((c: CategoryListItem) => {
		setOpen((o) => {
			const next = new Set(o);
			if (next.has(c.id)) { next.delete(c.id); return next; }
			next.add(c.id);
			return next;
		});
		if (!branches[c.id]) loadBranch(c.id);
	}, [branches, loadBranch]);

	// One row, plus its branch when open. Depth only drives the indent.
	//
	// Search results are always leaves. They are matches from anywhere in the tree, shown with
	// their path, so opening one would mix a branch into a flat result list -- and a child that
	// also matched would then appear twice, once as its own result and once under its parent.
	function renderRow(c: CategoryListItem, depth: number) {
		const canOpen = !searching && c.has_children;
		const isOpen = !searching && open.has(c.id);
		const branch = branches[c.id];
		return (
			<div key={c.id}>
				<div className="hk-row" style={{ paddingLeft: `calc(${depth} * 1.25rem)` }}>
					{canOpen ? (
						<button
							type="button"
							className="hk-iconbtn hk-disclose"
							aria-label={isOpen ? t('categories.collapse') : t('categories.expand')}
							aria-expanded={isOpen}
							onClick={() => toggle(c)}>
							<Icon name="chevron" size={16} className={isOpen ? 'hk-disclose-open' : ''} />
						</button>
					) : <span className="hk-disclose-spacer" />}
					<button type="button" className="hk-row-grow hk-row-btn" onClick={() => nav(`/categories/${c.id}/edit`)}>
						<span className="hk-row-title">
							{c.name}
							{!c.published && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('product.unpublished')}</span>}
						</span>
						{c.path && c.path.length > 0 && (
							<span className="hk-row-sub">{c.path.map((p) => p.name).join(' › ')}</span>
						)}
					</button>
				</div>
				{isOpen && (
					<div className="hk-branch">
						{branch?.error && <div className="hk-error-note">{tError(t, branch.error)}</div>}
						{branch?.items.map((child) => renderRow(child, depth + 1))}
						{branch?.loading && <div className="hk-center-col"><Spinner /></div>}
						{branch && !branch.loading && branch.items.length < branch.total && (
							<button
								type="button"
								className="hk-btn hk-btn--sm"
								style={{ marginLeft: `calc(${depth + 1} * 1.25rem)` }}
								onClick={() => loadBranch(c.id, branch.items.length)}>
								{t('list.loadMore')}
							</button>
						)}
					</div>
				)}
			</div>
		);
	}

	return (
		<Screen
			scrollResetKey={`${kind}|${search}`}
			title={t('categories.title')}
			right={<NewButton onClick={() => nav(`/categories/new?type=${kind}`)} />}
		>
			<Search value={search} onChange={setSearch} placeholder={t('categories.search')} />
			<div className="hk-filter-bar">
				<button type="button" className={`hk-chip${kind === 'product' ? ' hk-on' : ''}`} onClick={() => setKind('product')}>{t('categories.categories')}</button>
				<button type="button" className={`hk-chip${kind === 'manufacturer' ? ' hk-on' : ''}`} onClick={() => setKind('manufacturer')}>{t('categories.brands')}</button>
			</div>

			{top.loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : top.error ? (
				<div className="hk-error-note">{tError(t, top.error)}</div>
			) : top.items.length === 0 ? (
				<div className="hk-empty">{searching ? t('categories.noMatch') : t('categories.none')}</div>
			) : (
				<div>
					{top.items.map((c) => renderRow(c, 0))}
					<LoadMore
						shown={top.items.length}
						total={top.total}
						hasMore={top.hasMore}
						loading={top.loadingMore}
						error={top.moreError}
						onLoad={top.loadMore}
					/>
				</div>
			)}
		</Screen>
	);
}
