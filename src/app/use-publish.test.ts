// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePublish } from './use-publish';

interface Row { id: number; published: boolean }

const rowA: Row = { id: 1, published: true };
const rowB: Row = { id: 2, published: false };

function setup(save: (row: Row, published: boolean) => Promise<unknown>, resetKey = 'q') {
	return renderHook(
		({ k }: { k: string }) => usePublish<Row>({ save, resetKey: k }),
		{ initialProps: { k: resetKey } },
	);
}

describe('usePublish', () => {
	it('reads a row as the shop sent it until it is toggled', () => {
		const { result } = setup(() => Promise.resolve());
		expect(result.current.isPublished(rowA)).toBe(true);
		expect(result.current.isPublished(rowB)).toBe(false);
	});

	it('flips the row before the request answers, and sends the new value', async () => {
		let settle: () => void = () => {};
		const save = vi.fn(() => new Promise<void>((r) => { settle = r; }));
		const { result } = setup(save);

		act(() => result.current.toggle(rowA));
		// Flipped on screen, and known to be in flight, while the request is still open.
		expect(result.current.isPublished(rowA)).toBe(false);
		expect(result.current.busy[1]).toBe(true);
		expect(save).toHaveBeenCalledWith(rowA, false);

		await act(async () => { settle(); });
		expect(result.current.isPublished(rowA)).toBe(false);
		expect(result.current.busy[1]).toBeUndefined();
		expect(result.current.error).toBe('');
	});

	it('puts the row back and says why when the shop refuses', async () => {
		const save = vi.fn(() => Promise.reject(Object.assign(new Error('nope'), { code: 'forbidden' })));
		const { result } = setup(save);

		act(() => result.current.toggle(rowA));
		expect(result.current.isPublished(rowA)).toBe(false);

		await waitFor(() => expect(result.current.error).toBe('forbidden'));
		expect(result.current.isPublished(rowA)).toBe(true);
		expect(result.current.busy[1]).toBeUndefined();
	});

	it('reports a failure with no code as a generic one', async () => {
		const { result } = setup(() => Promise.reject(new Error('offline')));
		act(() => result.current.toggle(rowB));
		await waitFor(() => expect(result.current.error).toBe('generic'));
		expect(result.current.isPublished(rowB)).toBe(false);
	});

	it('toggles back and forth from what is on screen, not from the stale row', async () => {
		const save = vi.fn(() => Promise.resolve());
		const { result } = setup(save);

		await act(async () => { result.current.toggle(rowA); });
		expect(result.current.isPublished(rowA)).toBe(false);
		await act(async () => { result.current.toggle(rowA); });
		expect(result.current.isPublished(rowA)).toBe(true);
		expect(save).toHaveBeenNthCalledWith(1, rowA, false);
		expect(save).toHaveBeenNthCalledWith(2, rowA, true);
	});

	// A different query is a different set of rows, freshly loaded, so nothing remembered here
	// should survive it -- least of all an error about a row that is no longer on screen.
	it('forgets what it held when the query changes', async () => {
		const { result, rerender } = setup(() => Promise.reject(new Error('x')));
		await act(async () => { result.current.toggle(rowA); });
		await waitFor(() => expect(result.current.error).toBe('generic'));

		rerender({ k: 'another query' });
		expect(result.current.error).toBe('');
		expect(result.current.isPublished(rowA)).toBe(true);
	});
});
