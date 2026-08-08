// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaged } from './use-paged';
import type { Paginated } from '../core';

interface Row { id: number }

// A fake listing endpoint: `total` rows, served `size` at a time, honouring `start`.
function server(total: number, size = 30) {
	const calls: { start: number; query: string }[] = [];
	const fetch = (query: string) => (start: number): Promise<Paginated<Row>> => {
		calls.push({ start, query });
		const items = Array.from({ length: Math.max(0, Math.min(size, total - start)) },
			(_, i) => ({ id: start + i }));
		return Promise.resolve({ items, total, start, limit: size });
	};
	return { fetch, calls };
}

function setup(fetch: (start: number) => Promise<Paginated<Row>>, deps: unknown[] = ['q']) {
	return renderHook(
		({ f, d }: { f: (s: number) => Promise<Paginated<Row>>; d: unknown[] }) => usePaged<Row>({
			enabled: true,
			read: () => Promise.resolve(null),
			write: () => Promise.resolve(),
			fetch: f,
			deps: d,
		}),
		{ initialProps: { f: fetch, d: deps } },
	);
}

describe('usePaged', () => {
	it('reports what is loaded out of the total, and that there is more', async () => {
		const { fetch } = server(50);
		const { result } = setup(fetch('a'));
		await waitFor(() => expect(result.current.items).toHaveLength(30));
		expect(result.current.total).toBe(50);
		expect(result.current.hasMore).toBe(true);
	});

	// A search with 50 hits is two pages: 30 then the remaining 20.
	it('appends the next page and stops when the last one is short', async () => {
		const { fetch } = server(50);
		const { result } = setup(fetch('a'));
		await waitFor(() => expect(result.current.items).toHaveLength(30));

		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.items).toHaveLength(50));
		expect(result.current.items.map((r) => r.id)).toEqual(Array.from({ length: 50 }, (_, i) => i));
		expect(result.current.hasMore).toBe(false);
	});

	it('never asks for the same rows twice', async () => {
		const s = server(90);
		const { result } = setup(s.fetch('a'));
		await waitFor(() => expect(result.current.items).toHaveLength(30));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.items).toHaveLength(60));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.items).toHaveLength(90));
		expect(s.calls.map((c) => c.start)).toEqual([0, 30, 60]);
		expect(new Set(result.current.items.map((r) => r.id)).size).toBe(90);
	});

	it('ignores a second request while one is already in flight', async () => {
		const s = server(90);
		const { result } = setup(s.fetch('a'));
		await waitFor(() => expect(result.current.items).toHaveLength(30));
		act(() => {
			result.current.loadMore();
			result.current.loadMore();
			result.current.loadMore();
		});
		await waitFor(() => expect(result.current.items).toHaveLength(60));
		expect(s.calls.filter((c) => c.start === 30)).toHaveLength(1);
	});

	// Changing the search must start again from the top, not keep the previous list's rows.
	it('goes back to the first page when the query changes', async () => {
		const a = server(90);
		const b = server(5);
		const { result, rerender } = setup(a.fetch('a'), ['a']);
		await waitFor(() => expect(result.current.items).toHaveLength(30));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.items).toHaveLength(60));

		rerender({ f: b.fetch('b'), d: ['b'] });
		await waitFor(() => expect(result.current.total).toBe(5));
		expect(result.current.items).toHaveLength(5);
		expect(result.current.hasMore).toBe(false);
	});

	// Clearing a search is just another query change: back to the first page of everything.
	it('goes back to the first page when the query is cleared', async () => {
		const filtered = server(50);
		const all = server(300);
		const { result, rerender } = setup(filtered.fetch('q'), ['q']);
		await waitFor(() => expect(result.current.items).toHaveLength(30));
		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.items).toHaveLength(50));

		rerender({ f: all.fetch(''), d: [''] });
		await waitFor(() => expect(result.current.total).toBe(300));
		expect(result.current.items).toHaveLength(30);
		expect(result.current.hasMore).toBe(true);
	});

	// The race the query token exists for: a page requested for the previous query answers after
	// the new first page has arrived. The row counts line up, so only the token catches it.
	it('drops a page that answers a query we have left', async () => {
		let releaseStale: (p: Paginated<Row>) => void = () => {};
		const stale = (start: number): Promise<Paginated<Row>> => {
			if (start === 0) return Promise.resolve({ items: [{ id: 1 }], total: 100, start, limit: 30 });
			return new Promise((res) => { releaseStale = res; });
		};
		const fresh = (start: number): Promise<Paginated<Row>> =>
			Promise.resolve({ items: [{ id: 900 + start }], total: 100, start, limit: 30 });

		const { result, rerender } = setup(stale, ['a']);
		await waitFor(() => expect(result.current.items).toHaveLength(1));
		act(() => result.current.loadMore()); // in flight for query 'a'

		rerender({ f: fresh, d: ['b'] });
		await waitFor(() => expect(result.current.items).toEqual([{ id: 900 }]));

		// The old query's page finally answers; it must not join the new list.
		await act(async () => {
			releaseStale({ items: [{ id: 4242 }], total: 100, start: 1, limit: 30 });
			await Promise.resolve();
		});
		expect(result.current.items).toEqual([{ id: 900 }]);
	});

	it('keeps the rows it has when a further page fails, and can retry', async () => {
		let fail = true;
		const flaky = (start: number): Promise<Paginated<Row>> => {
			if (start === 0) return Promise.resolve({ items: [{ id: 0 }], total: 90, start, limit: 30 });
			if (fail) { fail = false; return Promise.reject(Object.assign(new Error('x'), { code: 'network' })); }
			return Promise.resolve({ items: [{ id: 1 }], total: 90, start, limit: 30 });
		};
		const { result } = setup(flaky);
		await waitFor(() => expect(result.current.items).toHaveLength(1));

		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.moreError).toBe('network'));
		expect(result.current.items).toHaveLength(1); // what was loaded stays on screen

		act(() => result.current.loadMore());
		await waitFor(() => expect(result.current.items).toHaveLength(2));
		expect(result.current.moreError).toBe('');
	});

	it('does not offer more when the first page is the whole list', async () => {
		const { fetch } = server(12);
		const { result } = setup(fetch('a'));
		await waitFor(() => expect(result.current.items).toHaveLength(12));
		expect(result.current.hasMore).toBe(false);
	});

	it('does not offer more for an empty result', async () => {
		const { fetch } = server(0);
		const { result } = setup(fetch('a'));
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.items).toHaveLength(0);
		expect(result.current.hasMore).toBe(false);
	});

	it('does not fetch at all while disabled', async () => {
		const s = server(90);
		renderHook(() => usePaged<Row>({
			enabled: false,
			read: () => Promise.resolve(null),
			write: () => Promise.resolve(),
			fetch: s.fetch('a'),
			deps: ['a'],
		}));
		await new Promise((r) => setTimeout(r, 20));
		expect(s.calls).toHaveLength(0);
	});
});
