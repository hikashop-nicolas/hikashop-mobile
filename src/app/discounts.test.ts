import { describe, it, expect } from 'vitest';
import { validateDiscount } from './discounts';

describe('validateDiscount', () => {
	it('accepts a valid percent coupon', () => {
		expect(validateDiscount({ type: 'coupon', code: 'SUMMER', kind: 'percent', value: 20 })).toBeNull();
	});
	it('accepts a valid flat coupon', () => {
		expect(validateDiscount({ type: 'coupon', code: 'FIVE', kind: 'flat', value: 5 })).toBeNull();
	});
	it('requires a code for a coupon', () => {
		expect(validateDiscount({ type: 'coupon', code: '  ', kind: 'percent', value: 20 })).toBe('discount.errCode');
	});
	it('does not require a code for an automatic discount', () => {
		expect(validateDiscount({ type: 'discount', code: '', kind: 'percent', value: 20 })).toBeNull();
	});
	it('requires a positive value', () => {
		expect(validateDiscount({ type: 'coupon', code: 'X', kind: 'flat', value: 0 })).toBe('discount.errValue');
		expect(validateDiscount({ type: 'discount', code: '', kind: 'flat', value: -3 })).toBe('discount.errValue');
	});
	it('rejects a percent over 100', () => {
		expect(validateDiscount({ type: 'coupon', code: 'X', kind: 'percent', value: 150 })).toBe('discount.errPercent');
		// but a flat amount over 100 is fine
		expect(validateDiscount({ type: 'coupon', code: 'X', kind: 'flat', value: 150 })).toBeNull();
	});
});
