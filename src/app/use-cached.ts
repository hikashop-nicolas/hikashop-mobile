import { useEffect, useRef, useState } from 'react';
import type { Cached } from '../core';

// Cache-then-network for a read model: show the cached value instantly (if any), then refresh
// from the network and update both the view and the cache. A network failure keeps the cached
// value on screen and only surfaces as an error when there is nothing cached to show.

export interface CachedState<T> {
	data: T | null;
	loading: boolean; // no data yet and a fetch is in flight
	refreshing: boolean; // showing data while a background fetch runs
	error: string; // only set when there is no data to fall back on
	fetchedAt: number | null;
	fromCache: boolean;
}

interface Params<T> {
	enabled: boolean;
	read: () => Promise<Cached<T> | null>;
	fetch: () => Promise<T>;
	write: (data: T) => Promise<void>;
	deps: unknown[];
	debounceMs?: number;
}

const IDLE = { data: null, loading: false, refreshing: false, error: '', fetchedAt: null, fromCache: false } as const;

export function useCached<T>(params: Params<T>): CachedState<T> {
	const { enabled, deps, debounceMs = 0 } = params;
	// Keep the latest callbacks in a ref so the effect can re-run purely on `deps`.
	const latest = useRef(params);
	latest.current = params;
	// Collapse the caller's deps (primitives) into one stable key for the effect.
	const depKey = JSON.stringify(deps);

	const [state, setState] = useState<CachedState<T>>({ ...IDLE, loading: true });

	useEffect(() => {
		if (!enabled) {
			setState({ ...IDLE });
			return;
		}
		let cancelled = false;
		let gotNetwork = false;
		// A dep change means a different query (e.g. a new status filter). Drop the previous
		// query's data so it cannot linger on screen (which reads as "the filter did nothing")
		// while the new one loads; the cache read below repaints instantly when it has a hit.
		setState({ ...IDLE, loading: true });

		// Cache first: paint immediately, unless the network already won the race.
		void latest.current.read().then((c) => {
			if (cancelled || !c || gotNetwork) return;
			setState((s) => (s.data != null ? s : { ...s, data: c.data, fetchedAt: c.fetchedAt, fromCache: true, loading: false, refreshing: true }));
		}).catch(() => {});

		const run = () => {
			setState((s) => ({ ...s, refreshing: true }));
			latest.current.fetch().then((data) => {
				if (cancelled) return;
				gotNetwork = true;
				setState({ data, loading: false, refreshing: false, error: '', fetchedAt: Date.now(), fromCache: false });
				void latest.current.write(data).catch(() => {});
			}).catch((e) => {
				if (cancelled) return;
				setState((s) => ({
					...s,
					loading: false,
					refreshing: false,
					error: s.data == null ? (e instanceof Error ? e.message : 'Failed to load.') : '',
				}));
			});
		};

		let timer: ReturnType<typeof setTimeout> | null = null;
		if (debounceMs > 0) timer = setTimeout(run, debounceMs);
		else run();

		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
		};
	}, [enabled, debounceMs, depKey]);

	return state;
}
