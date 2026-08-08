import { describe, it, expect } from 'vitest';
import { validateDiscount } from './discounts';

describe('validateDiscount', () => {
	it('accepts a valid percent coupon', () => {
		expect(validateDiscount({ code: 'SUMMER', kind: 'percent', value: 20 })).toBeNull();
	});
	it('accepts a valid flat coupon', () => {
		expect(validateDiscount({ code: 'FIVE', kind: 'flat', value: 5 })).toBeNull();
	});
	it('requires a code', () => {
		expect(validateDiscount({ code: '  ', kind: 'percent', value: 20 })).toBe('discount.errCode');
	});
	it('requires a positive value', () => {
		expect(validateDiscount({ code: 'X', kind: 'flat', value: 0 })).toBe('discount.errValue');
		expect(validateDiscount({ code: 'X', kind: 'flat', value: -3 })).toBe('discount.errValue');
	});
	it('rejects a percent over 100', () => {
		expect(validateDiscount({ code: 'X', kind: 'percent', value: 150 })).toBe('discount.errPercent');
		// but a flat amount over 100 is fine
		expect(validateDiscount({ code: 'X', kind: 'flat', value: 150 })).toBeNull();
	});
});
