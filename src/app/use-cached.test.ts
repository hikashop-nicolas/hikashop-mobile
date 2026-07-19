// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCached } from './use-cached';
import type { Cached } from '../core';

function deferred<T>() {
	let resolve!: (v: T) => void;
	let reject!: (e: unknown) => void;
	const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
	return { promise, resolve, reject };
}

const cached = <T>(data: T, fetchedAt = 1): Cached<T> => ({ data, fetchedAt });

describe('useCached', () => {
	it('loads from the network when the cache misses', async () => {
		const { result } = renderHook(() =>
			useCached<string>({
				enabled: true,
				read: async () => null,
				fetch: async () => 'NET',
				write: async () => {},
				deps: ['a'],
			}),
		);
		expect(result.current.loading).toBe(true);
		await waitFor(() => expect(result.current.data).toBe('NET'));
		expect(result.current.loading).toBe(false);
		expect(result.current.fromCache).toBe(false);
	});

	it('paints the cache first, then refreshes from the network', async () => {
		const net = deferred<string>();
		const { result } = renderHook(() =>
			useCached<string>({
				enabled: true,
				read: async () => cached('CACHE'),
				fetch: () => net.promise,
				write: async () => {},
				deps: ['a'],
			}),
		);
		await waitFor(() => expect(result.current.data).toBe('CACHE'));
		expect(result.current.fromCache).toBe(true);
		net.resolve('NET');
		await waitFor(() => expect(result.current.data).toBe('NET'));
		expect(result.current.fromCache).toBe(false);
	});

	it('clears the previous query data when deps change (filter switch)', async () => {
		const fetch = vi.fn<() => Promise<string>>();
		const a = deferred<string>();
		const b = deferred<string>();
		fetch.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);

		const { result, rerender } = renderHook(
			({ q }) => useCached<string>({ enabled: true, read: async () => null, fetch, write: async () => {}, deps: [q] }),
			{ initialProps: { q: 'confirmed' } },
		);
		a.resolve('LIST_CONFIRMED');
		await waitFor(() => expect(result.current.data).toBe('LIST_CONFIRMED'));

		// Switch filter: the old list must not linger while the new query loads.
		rerender({ q: 'created' });
		expect(result.current.data).toBeNull();
		expect(result.current.loading).toBe(true);

		b.resolve('LIST_CREATED');
		await waitFor(() => expect(result.current.data).toBe('LIST_CREATED'));
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('keeps cached data on a network error and does not surface an error', async () => {
		const net = deferred<string>();
		const { result } = renderHook(() =>
			useCached<string>({
				enabled: true,
				read: async () => cached('CACHE'),
				fetch: () => net.promise,
				write: async () => {},
				deps: ['a'],
			}),
		);
		await waitFor(() => expect(result.current.data).toBe('CACHE'));
		net.reject(new Error('offline'));
		await waitFor(() => expect(result.current.refreshing).toBe(false));
		expect(result.current.data).toBe('CACHE');
		expect(result.current.error).toBe('');
	});

	it('surfaces the error when a network failure has no cache to fall back on', async () => {
		const net = deferred<string>();
		const { result } = renderHook(() =>
			useCached<string>({
				enabled: true,
				read: async () => null,
				fetch: () => net.promise,
				write: async () => {},
				deps: ['a'],
			}),
		);
		net.reject(new Error('offline'));
		await waitFor(() => expect(result.current.error).toBe('offline'));
		expect(result.current.data).toBeNull();
	});
});
