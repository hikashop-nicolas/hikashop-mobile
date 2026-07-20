import { describe, it, expect } from 'vitest';
import { formatMoney } from './currency';
import type { Currency } from '../core';

const EUR: Currency = { id: 1, code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, decimal_sep: ',', thousands_sep: '.', symbol_before: false, space: true };
const USD: Currency = { id: 2, code: 'USD', symbol: '$', name: 'Dollar', decimals: 2, decimal_sep: '.', thousands_sep: ',', symbol_before: true, space: false };
const JPY: Currency = { id: 3, code: 'JPY', symbol: '¥', name: 'Yen', decimals: 0, decimal_sep: '.', thousands_sep: ',', symbol_before: true, space: false };

describe('formatMoney', () => {
	it('formats EUR with symbol after and a space, comma decimal, dot thousands', () => {
		expect(formatMoney(1234.5, EUR)).toBe('1.234,50 €');
		expect(formatMoney(0, EUR)).toBe('0,00 €');
	});

	it('formats USD with symbol before and no space', () => {
		expect(formatMoney(1234.5, USD)).toBe('$1,234.50');
		expect(formatMoney(9, USD)).toBe('$9.00');
	});

	it('honours a zero-decimal currency and rounds', () => {
		expect(formatMoney(1234.5, JPY)).toBe('¥1,235');
		expect(formatMoney(100, JPY)).toBe('¥100');
	});

	it('keeps the sign outside the symbol for negatives', () => {
		expect(formatMoney(-5, USD)).toBe('-$5.00');
		expect(formatMoney(-1234.5, EUR)).toBe('-1.234,50 €');
	});

	it('groups large numbers with the currency thousands separator', () => {
		expect(formatMoney(1234567.89, USD)).toBe('$1,234,567.89');
		expect(formatMoney(1234567.89, EUR)).toBe('1.234.567,89 €');
	});

	it('falls back to a plain number when no currency is given', () => {
		expect(formatMoney(9.5)).toBe('9.50');
		expect(formatMoney(1000)).toBe('1,000.00');
	});

	it('treats non-finite input as zero', () => {
		expect(formatMoney(Number.NaN, USD)).toBe('$0.00');
		expect(formatMoney(Infinity, EUR)).toBe('0,00 €');
	});
});
