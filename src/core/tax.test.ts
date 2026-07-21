import { describe, it, expect } from 'vitest';
import { inclFromExcl, exclFromIncl } from './tax';

describe('tax conversion', () => {
	it('adds tax to an excl-tax price', () => {
		expect(inclFromExcl(100, 0.06)).toBe(106);
		expect(inclFromExcl(27.5, 0.2)).toBe(33);
	});
	it('removes tax from an incl-tax price', () => {
		expect(exclFromIncl(106, 0.06)).toBe(100);
		expect(exclFromIncl(33, 0.2)).toBe(27.5);
	});
	it('is a no-op at rate 0', () => {
		expect(inclFromExcl(42, 0)).toBe(42);
		expect(exclFromIncl(42, 0)).toBe(42);
	});
	it('round-trips within rounding', () => {
		expect(exclFromIncl(inclFromExcl(19.99, 0.2), 0.2)).toBe(19.99);
	});
});
