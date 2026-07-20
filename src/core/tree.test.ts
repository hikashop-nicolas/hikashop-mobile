import { describe, it, expect } from 'vitest';
import { flattenTree } from './tree';

describe('flattenTree', () => {
	it('orders children under their parent with increasing depth', () => {
		const rows = flattenTree([
			{ id: 1, parent_id: 0 },
			{ id: 2, parent_id: 1 },
			{ id: 3, parent_id: 2 },
			{ id: 4, parent_id: 1 },
		]);
		expect(rows.map((r) => [r.item.id, r.depth])).toEqual([
			[1, 0], [2, 1], [3, 2], [4, 1],
		]);
	});

	it('treats a node whose parent is absent as a root (subtree slice)', () => {
		// 2's parent (1) is not in the set, so 2 becomes a root.
		const rows = flattenTree([
			{ id: 2, parent_id: 1 },
			{ id: 3, parent_id: 2 },
		]);
		expect(rows.map((r) => [r.item.id, r.depth])).toEqual([[2, 0], [3, 1]]);
	});

	it('keeps input order among siblings', () => {
		const rows = flattenTree([
			{ id: 5, parent_id: 0 },
			{ id: 4, parent_id: 0 },
			{ id: 6, parent_id: 0 },
		]);
		expect(rows.map((r) => r.item.id)).toEqual([5, 4, 6]);
	});

	it('returns an empty list for no items', () => {
		expect(flattenTree([])).toEqual([]);
	});
});
