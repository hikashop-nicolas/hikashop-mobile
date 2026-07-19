import { describe, it, expect } from 'vitest';
import { maxOrderId, newOrdersSince } from './poll';
import type { OrderSummary } from './models';

const o = (id: number): OrderSummary => ({ id } as OrderSummary);

describe('poll helpers', () => {
	it('maxOrderId finds the highest id, 0 for empty', () => {
		expect(maxOrderId([])).toBe(0);
		expect(maxOrderId([o(3), o(28), o(11)])).toBe(28);
	});

	it('newOrdersSince returns only ids above the cursor, oldest first', () => {
		const orders = [o(28), o(26), o(24)]; // as returned newest-first
		expect(newOrdersSince(orders, 24).map((x) => x.id)).toEqual([26, 28]);
	});

	it('newOrdersSince is empty when nothing is newer', () => {
		expect(newOrdersSince([o(28), o(26)], 28)).toEqual([]);
		expect(newOrdersSince([], 5)).toEqual([]);
	});

	it('newOrdersSince returns all when the cursor is 0', () => {
		expect(newOrdersSince([o(2), o(1)], 0).map((x) => x.id)).toEqual([1, 2]);
	});
});
