import { useCallback, useRef, useState } from 'react';

// State that outlives leaving the screen it belongs to.
//
// A listing's search and filters are how you left it, and stepping over to another tab to check
// something should not throw them away. HikaShop's backend keeps its listing filters in the user
// session for the same reason; this is that, per store.
//
// Session storage rather than local: a filter chosen now should still be there after moving
// between tabs or reloading, but a category filter set weeks ago should not silently be hiding
// most of the catalogue the next time the app is opened.
const PREFIX = 'hk.filter.';

function read<T>(key: string, fallback: T): T {
	try {
		const raw = sessionStorage.getItem(PREFIX + key);
		return raw === null ? fallback : (JSON.parse(raw) as T);
	} catch {
		// No storage (private mode, an embedded webview), or something unparseable left by an
		// older build. Neither is worth failing a listing over.
		return fallback;
	}
}

function write<T>(key: string, value: T): void {
	try {
		sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch { /* remembering is a convenience, never a requirement */ }
}

// Like useState, but remembered under `key`. Keys are expected to carry the store id: switching
// store must not carry a category filter over to a shop where that category does not exist.
export function useSticky<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
	const [value, setValue] = useState<T>(() => read(key, initial));

	// A changed key is a different thing being remembered, so its own stored value takes over.
	// Adjusting state during render is React's own answer to state derived from props; the ref
	// makes it happen once per change rather than every render.
	const seen = useRef(key);
	if (seen.current !== key) {
		seen.current = key;
		setValue(read(key, initial));
	}

	const set = useCallback((next: T | ((prev: T) => T)) => {
		setValue((prev) => {
			const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
			write(key, resolved);
			return resolved;
		});
	}, [key]);

	return [value, set];
}
