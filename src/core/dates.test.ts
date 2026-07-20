import { describe, it, expect } from 'vitest';
import { tsToDate, dateToTs } from './dates';

describe('date helpers', () => {
	it('converts a unix timestamp to yyyy-mm-dd (UTC)', () => {
		expect(tsToDate(1735689600)).toBe('2025-01-01'); // 2025-01-01T00:00:00Z
		expect(tsToDate(0)).toBe('');
	});

	it('converts yyyy-mm-dd to a unix timestamp at UTC midnight', () => {
		expect(dateToTs('2025-01-01')).toBe(1735689600);
		expect(dateToTs('')).toBe(0);
	});

	it('round-trips a date', () => {
		expect(tsToDate(dateToTs('2026-07-20'))).toBe('2026-07-20');
	});
});
