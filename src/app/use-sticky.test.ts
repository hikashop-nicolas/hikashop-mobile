// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSticky } from './use-sticky';

function setup<T>(key: string, initial: T) {
	return renderHook(({ k }: { k: string }) => useSticky<T>(k, initial), { initialProps: { k: key } });
}

describe('useSticky', () => {
	beforeEach(() => sessionStorage.clear());

	it('starts at the initial value when nothing was remembered', () => {
		const { result } = setup('orders.status.s1', '');
		expect(result.current[0]).toBe('');
	});

	it('keeps what was set, so leaving the screen and coming back finds it', () => {
		const first = setup('orders.status.s1', '');
		act(() => first.result.current[1]('shipped'));
		expect(first.result.current[0]).toBe('shipped');

		first.unmount();
		const again = setup('orders.status.s1', '');
		expect(again.result.current[0]).toBe('shipped');
	});

	it('accepts an updater, like useState', () => {
		const { result } = setup('products.search.s1', 'a');
		act(() => result.current[1]((prev) => prev + 'b'));
		expect(result.current[0]).toBe('ab');
	});

	it('remembers values that are not strings', () => {
		const { result } = setup('products.category.s1', 0);
		act(() => result.current[1](42));
		expect(result.current[0]).toBe(42);
		expect(setup('products.category.s1', 0).result.current[0]).toBe(42);
	});

	// The point of keying by store: a category id from one shop means nothing in another.
	it('switches to the other key\'s value when the key changes', () => {
		const { result, rerender } = setup('products.category.s1', 0);
		act(() => result.current[1](42));

		rerender({ k: 'products.category.s2' });
		expect(result.current[0]).toBe(0);

		act(() => result.current[1](7));
		rerender({ k: 'products.category.s1' });
		expect(result.current[0]).toBe(42);
	});

	it('falls back to the initial value when what was stored is unreadable', () => {
		sessionStorage.setItem('hk.filter.orders.status.s1', '{not json');
		expect(setup('orders.status.s1', '').result.current[0]).toBe('');
	});

	it('still works when there is no storage at all', () => {
		const real = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
		Object.defineProperty(window, 'sessionStorage', {
			configurable: true,
			get() { throw new Error('denied'); },
		});
		try {
			const { result } = setup('orders.status.s1', '');
			act(() => result.current[1]('shipped'));
			expect(result.current[0]).toBe('shipped');
		} finally {
			if (real) Object.defineProperty(window, 'sessionStorage', real);
		}
	});
});
