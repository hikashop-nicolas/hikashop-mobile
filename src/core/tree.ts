// A node in a flat, parent-linked list (categories, folders...).
export interface FlatNode {
	id: number;
	parent_id: number;
}

// Flatten a parent-linked list into depth-ordered rows for an indented tree view.
// Nodes whose parent is not in the set are treated as roots, so a subtree slice
// still renders. Order within a level follows input order.
export function flattenTree<T extends FlatNode>(items: T[]): { item: T; depth: number }[] {
	const ids = new Set(items.map((i) => i.id));
	const byParent = new Map<number, T[]>();
	for (const i of items) {
		const key = ids.has(i.parent_id) ? i.parent_id : 0;
		const arr = byParent.get(key) ?? [];
		arr.push(i);
		byParent.set(key, arr);
	}
	const out: { item: T; depth: number }[] = [];
	const walk = (parent: number, depth: number) => {
		for (const i of byParent.get(parent) ?? []) {
			out.push({ item: i, depth });
			walk(i.id, depth + 1);
		}
	};
	walk(0, 0);
	return out;
}
