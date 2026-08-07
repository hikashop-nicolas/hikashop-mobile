import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useStores } from './store-context';
import { useVersions } from './versions';

interface HikaDictValue {
	// Resolve a HikaShop language key to the store's text (localized + merchant overrides),
	// falling back to the given fallback, then to the key itself.
	hk: (key: string, fallback?: string) => string;
}

const HikaDictContext = createContext<HikaDictValue>({ hk: (key, fallback) => fallback ?? key });

// Loads HikaShop's translation dictionary for the active store and locale (cache-first), and
// re-downloads it only when its shared change token differs, so the app can render
// HikaShop-sourced strings the way the store does, including any text the merchant customized.
export function HikaDictProvider({ children }: { children: ReactNode }) {
	const { client, active, cache } = useStores();
	const { versions, tag } = useVersions();
	const [strings, setStrings] = useState<Record<string, string>>({});

	useEffect(() => {
		if (!client || !active) { setStrings({}); return; }
		const storeId = active.id;
		const name = `i18n.${tag}`;
		let alive = true;
		void (async () => {
			const cached = await cache.getTranslations(storeId, tag);
			if (cached && alive) setStrings(cached.data.strings);
			if (!versions) return; // wait for the shared change token
			try {
				// Only re-download the (large) dictionary when its change token differs.
				const seen = await cache.getVersionTag(storeId, name);
				if (cached && seen === versions.i18n) return;
				const d = await client.getTranslations(tag);
				if (!alive) return;
				setStrings(d.strings);
				await cache.putTranslations(storeId, tag, d);
				await cache.putVersionTag(storeId, name, versions.i18n);
			} catch { /* keep whatever we have; HikaShop strings just fall back */ }
		})();
		return () => { alive = false; };
	}, [client, active, tag, cache, versions]);

	const hk = useCallback(
		(key: string, fallback?: string) => (key && strings[key] ? strings[key] : (fallback ?? key)),
		[strings],
	);

	return <HikaDictContext.Provider value={{ hk }}>{children}</HikaDictContext.Provider>;
}

export function useHk(): HikaDictValue['hk'] {
	return useContext(HikaDictContext).hk;
}
