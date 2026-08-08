// Pure helpers for the promotion editor, kept testable outside the component.
import type { DiscountType } from '../core';

export interface DiscountFormValues {
	type: DiscountType;
	code: string;
	kind: 'percent' | 'flat';
	value: number;
}

// Validate a promotion form. Returns an i18n error key, or null when the form is valid.
// Only a coupon needs a code; an automatic discount applies without one.
export function validateDiscount(v: DiscountFormValues): string | null {
	if (v.type === 'coupon' && !v.code.trim()) return 'discount.errCode';
	if (!(v.value > 0)) return 'discount.errValue';
	if (v.kind === 'percent' && v.value > 100) return 'discount.errPercent';
	return null;
}
