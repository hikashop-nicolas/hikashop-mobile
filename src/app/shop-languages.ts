import { useEffect, useState } from 'react';
import type { ShopLanguages } from '../core';
import { useStores } from './store-context';
import { useVersions } from './versions';

// Whether this shop can hold content translations at all, and in which languages. Cached against
// the change token the store already sends, since the answer moves only when a merchant publishes
// a language, and it decides whether a whole screen is offered.
//
// Null while unknown: the entry stays hidden rather than flickering into view and out again.
export function useShopLanguages(): ShopLanguages | null {
	const { client, active, cache } = useStores();
	const { versions } = useVersions();
	const [langs, setLangs] = useState<ShopLanguages | null>(null);

	useEffect(() => {
		if (!client || !active) { setLangs(null); return; }
		const storeId = active.id;
		let alive = true;
		void (async () => {
			const cached = await cache.getShopLanguages(storeId);
			if (cached && alive) setLangs(cached.data);
			if (!versions) return; // wait for the shared change token
			try {
				const seen = await cache.getVersionTag(storeId, 'languages');
				if (cached && seen === versions.languages) return;
				const d = await client.getShopLanguages();
				if (!alive) return;
				setLangs(d);
				await cache.putShopLanguages(storeId, d);
				await cache.putVersionTag(storeId, 'languages', versions.languages);
			} catch { /* keep whatever we have; the entry just stays as it was */ }
		})();
		return () => { alive = false; };
	}, [client, active, cache, versions]);

	return langs;
}
