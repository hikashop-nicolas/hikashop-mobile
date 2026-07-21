import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';

// A flat node with a parent link; the component builds the tree from these.
export interface TreeNode {
	id: number;
	name: string;
	parent_id: number;
}

interface TreeSelectProps {
	nodes: TreeNode[];
	selected: number[];
	onChange: (ids: number[]) => void;
	// Single select collapses to at most one id; multi keeps a set.
	multiple?: boolean;
	searchPlaceholder?: string;
	emptyLabel?: string;
	// When present, a footer button requests a full create flow (a modal/screen the
	// consumer owns); the component stays unaware of the create form.
	onAddRequest?: () => void;
	addLabel?: string;
}

interface Built {
	node: TreeNode;
	depth: number;
	children: Built[];
}

// Build a forest from the flat list. Nodes whose parent is absent become roots,
// so a subtree slice (e.g. only user categories) still renders.
function buildForest(nodes: TreeNode[]): Built[] {
	const byId = new Map<number, TreeNode>();
	for (const n of nodes) byId.set(n.id, n);
	const childrenOf = new Map<number, TreeNode[]>();
	const roots: TreeNode[] = [];
	for (const n of nodes) {
		if (n.parent_id && byId.has(n.parent_id)) {
			const arr = childrenOf.get(n.parent_id) ?? [];
			arr.push(n);
			childrenOf.set(n.parent_id, arr);
		} else {
			roots.push(n);
		}
	}
	const attach = (n: TreeNode, depth: number): Built => ({
		node: n,
		depth,
		children: (childrenOf.get(n.id) ?? []).map((c) => attach(c, depth + 1)),
	});
	return roots.map((r) => attach(r, 0));
}

// Ids of a node and all its descendants (used to know what a search match reveals).
function subtreeIds(b: Built): number[] {
	return [b.node.id, ...b.children.flatMap(subtreeIds)];
}

export function TreeSelect({
	nodes, selected, onChange, multiple = true,
	searchPlaceholder, emptyLabel, onAddRequest, addLabel,
}: TreeSelectProps) {
	const [query, setQuery] = useState('');
	const [expanded, setExpanded] = useState<Set<number>>(new Set());

	const forest = useMemo(() => buildForest(nodes), [nodes]);
	const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

	// Ancestor id chain of a node (nearest parent first).
	const ancestorsOf = useMemo(() => (id: number): number[] => {
		const chain: number[] = [];
		let cur = byId.get(id);
		const seen = new Set<number>();
		while (cur && cur.parent_id && byId.has(cur.parent_id) && !seen.has(cur.parent_id)) {
			seen.add(cur.parent_id);
			chain.push(cur.parent_id);
			cur = byId.get(cur.parent_id);
		}
		return chain;
	}, [byId]);

	// Full path (root -> node) as names, for the selected-chip labels.
	const pathOf = (id: number): string[] => {
		const node = byId.get(id);
		if (!node) return [];
		return [...ancestorsOf(id).map((a) => byId.get(a)?.name ?? '').reverse(), node.name].filter(Boolean);
	};

	// Reveal selected nodes on first load by expanding their ancestors (once, so the
	// user can still collapse afterwards).
	const didInit = useRef(false);
	useEffect(() => {
		if (didInit.current || nodes.length === 0 || selected.length === 0) return;
		didInit.current = true;
		const open = new Set<number>();
		for (const id of selected) for (const a of ancestorsOf(id)) open.add(a);
		if (open.size) setExpanded((s) => new Set([...s, ...open]));
	}, [nodes, selected, ancestorsOf]);

	const q = query.trim().toLowerCase();

	// A node is visible when it or any descendant matches the query; matching
	// branches auto-expand so the hit is reachable.
	const { visible, autoExpand } = useMemo(() => {
		if (!q) return { visible: null as Set<number> | null, autoExpand: new Set<number>() };
		const vis = new Set<number>();
		const exp = new Set<number>();
		const walk = (b: Built): boolean => {
			const selfMatch = b.node.name.toLowerCase().includes(q);
			let childMatch = false;
			for (const c of b.children) if (walk(c)) childMatch = true;
			if (selfMatch || childMatch) {
				vis.add(b.node.id);
				if (childMatch) exp.add(b.node.id);
				if (selfMatch) for (const id of subtreeIds(b)) vis.add(id);
			}
			return selfMatch || childMatch;
		};
		for (const r of forest) walk(r);
		return { visible: vis, autoExpand: exp };
	}, [forest, q]);

	// Count of selected strict-descendants per node, to badge collapsed parents.
	const selectedIn = useMemo(() => {
		const sel = new Set(selected);
		const counts = new Map<number, number>();
		const walk = (b: Built): number => {
			let below = 0;
			for (const c of b.children) below += (sel.has(c.node.id) ? 1 : 0) + walk(c);
			counts.set(b.node.id, below);
			return below;
		};
		for (const r of forest) walk(r);
		return counts;
	}, [forest, selected]);

	const isOpen = (id: number) => autoExpand.has(id) || expanded.has(id);
	function toggleOpen(id: number) {
		setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
	}

	function toggleSelect(id: number) {
		if (multiple) {
			onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
		} else {
			onChange(selected[0] === id ? [] : [id]);
		}
	}

	const rows: JSX.Element[] = [];
	const render = (b: Built) => {
		if (visible && !visible.has(b.node.id)) return;
		const sel = selected.includes(b.node.id);
		const hasChildren = b.children.length > 0;
		const open = isOpen(b.node.id);
		const hiddenSel = !open ? (selectedIn.get(b.node.id) ?? 0) : 0;
		rows.push(
			<div key={b.node.id} className="hk-tree-row" style={{ paddingLeft: `calc(${b.depth} * 1.25rem + 0.25rem)` }}>
				<button type="button" className={`hk-tree-twist${hasChildren ? '' : ' hk-tree-twist--leaf'}`}
					onClick={() => hasChildren && toggleOpen(b.node.id)} aria-label={open ? 'collapse' : 'expand'}>
					{hasChildren && <Icon name="chevron" size={16} className={open ? 'hk-rot90' : ''} />}
				</button>
				<button type="button" className={`hk-tree-label${sel ? ' hk-on' : ''}`} onClick={() => toggleSelect(b.node.id)}>
					<span className={`hk-tree-box${multiple ? '' : ' hk-tree-box--radio'}${sel ? ' hk-on' : ''}`}>
						{sel && <Icon name="check" size={13} />}
					</span>
					<span className="hk-tree-name">{b.node.name}</span>
					{hiddenSel > 0 && <span className="hk-tree-badge" title={`${hiddenSel} selected inside`}>{hiddenSel}</span>}
				</button>
			</div>,
		);
		if (open) for (const c of b.children) render(c);
	};

	for (const r of forest) render(r);

	// The selected items shown as removable chips, so nested selections are visible
	// without expanding the tree. Path context disambiguates same-named categories.
	const chips = multiple
		? selected.filter((id) => byId.has(id)).map((id) => ({ id, path: pathOf(id) }))
		: [];

	return (
		<div className="hk-tree">
			{chips.length > 0 && (
				<div className="hk-tree-chips">
					{chips.map(({ id, path }) => (
						<button key={id} type="button" className="hk-tree-chip" title={path.join(' / ')} onClick={() => toggleSelect(id)}>
							{path.length > 1 && <span className="hk-tree-chip-path">{path.slice(0, -1).join(' / ')} / </span>}
							<span className="hk-tree-chip-leaf">{path[path.length - 1]}</span>
							<Icon name="close" size={12} />
						</button>
					))}
				</div>
			)}
			<div className="hk-search hk-tree-search">
				<span className="hk-search-ic"><Icon name="search" size={16} /></span>
				<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} />
			</div>
			<div className="hk-tree-body">
				{rows.length > 0 ? rows : <div className="hk-empty">{emptyLabel}</div>}
			</div>
			{onAddRequest && (
				<button type="button" className="hk-tree-addroot" onClick={onAddRequest}>
					<Icon name="plus" size={15} /> {addLabel}
				</button>
			)}
		</div>
	);
}
