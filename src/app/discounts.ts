// Pure helpers for the coupon editor, kept testable outside the component.

export interface DiscountFormValues {
	code: string;
	kind: 'percent' | 'flat';
	value: number;
}

// Validate a coupon form. Returns an i18n error key, or null when the form is valid.
export function validateDiscount(v: DiscountFormValues): string | null {
	if (!v.code.trim()) return 'discount.errCode';
	if (!(v.value > 0)) return 'discount.errValue';
	if (v.kind === 'percent' && v.value > 100) return 'discount.errPercent';
	return null;
}
