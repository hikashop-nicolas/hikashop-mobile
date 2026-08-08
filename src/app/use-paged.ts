import { useCallback, useEffect, useRef, useState } from 'react';
import { useCached } from './use-cached';
import type { Cached, Paginated, ProductField } from '../core';

// A listing that can run to more rows than one request returns.
//
// The first page keeps the cache-then-network behaviour of useCached, so a listing still paints
// instantly from the cache and works offline. Further pages are fetched on demand and appended;
// they are deliberately not cached, since what matters offline is the top of the list, not an
// arbitrary number of pages somebody happened to scroll through last time.
//
// Changing a filter or the search term starts again from the first page.
export interface PagedState<T> {
	items: T[];
	total: number;
	// The custom fields the merchant chose to show in this listing (from the first page).
	fields: ProductField[];
	loading: boolean;      // nothing to show yet
	refreshing: boolean;
	error: string;         // an error CODE, only when there is nothing to show
	loadingMore: boolean;
	hasMore: boolean;
	loadMore: () => void;
	// Set when fetching a further page failed; the rows already loaded stay on screen.
	moreError: string;
}

export function usePaged<T>(params: {
	enabled: boolean;
	read: () => Promise<Cached<Paginated<T>> | null>;
	fetch: (start: number) => Promise<Paginated<T>>;
	write: (page: Paginated<T>) => Promise<void>;
	deps: unknown[];
	debounceMs?: number;
}): PagedState<T> {
	const { enabled, deps, debounceMs, read, write } = params;
	const fetchRef = useRef(params.fetch);
	fetchRef.current = params.fetch;

	const first = useCached<Paginated<T>>({
		enabled,
		read,
		write,
		deps,
		debounceMs,
		fetch: () => fetchRef.current(0),
	});

	const [more, setMore] = useState<T[]>([]);
	const [loadingMore, setLoadingMore] = useState(false);
	const [moreError, setMoreError] = useState('');
	// Guard against a second call while one is in flight: the sentinel can come into view again
	// while the rows that will push it away are still being fetched.
	const inFlight = useRef(false);

	// A different query is a different list: drop the pages loaded for the previous one, and
	// stop accepting anything still in flight for the old one. Without the token, a page
	// requested for the previous query can land after the new first page has arrived and be
	// appended to it -- the row counts line up, so nothing else would catch it.
	const depKey = JSON.stringify(deps);
	const queryToken = useRef(0);
	useEffect(() => {
		queryToken.current += 1;
		inFlight.current = false;
		setMore([]);
		setLoadingMore(false);
		setMoreError('');
	}, [depKey]);

	const firstItems = first.data?.items ?? [];
	const total = first.data?.total ?? 0;
	const items = more.length ? [...firstItems, ...more] : firstItems;
	const hasMore = first.data != null && items.length < total;

	const loadMore = useCallback(() => {
		if (inFlight.current) return;
		inFlight.current = true;
		setLoadingMore(true);
		setMoreError('');
		const start = items.length;
		const token = queryToken.current;
		fetchRef.current(start)
			.then((page) => {
				if (token !== queryToken.current) return; // answers a query we have left
				setMore((m) => {
					// Ignore a page that is no longer the next one, which a refresh of the first
					// page can cause by changing how many rows it holds.
					if (start !== (first.data?.items.length ?? 0) + m.length) return m;
					return [...m, ...(page.items ?? [])];
				});
			})
			.catch((e) => {
				if (token !== queryToken.current) return;
				const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string')
					? (e as { code: string }).code
					: 'generic';
				setMoreError(code);
			})
			.finally(() => {
				if (token !== queryToken.current) return;
				inFlight.current = false;
				setLoadingMore(false);
			});
	}, [items.length, first.data]);

	return {
		items,
		total,
		fields: first.data?.fields ?? [],
		loading: first.loading,
		refreshing: first.refreshing,
		error: first.error,
		loadingMore,
		hasMore,
		loadMore,
		moreError,
	};
}
