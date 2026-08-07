import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { OrderStatusDef } from '../core';
import { useStores } from './store-context';
import { useHk } from './hika-dict';
import { useI18n } from '../i18n';

interface StatusesValue {
	statuses: OrderStatusDef[]; // the shop's statuses, in configured order
	statusLabel: (namekey: string) => string;
	statusColor: (namekey: string) => string; // merchant hex or ''
}

const StatusesContext = createContext<StatusesValue>({ statuses: [], statusLabel: (k) => k, statusColor: () => '' });

function cap(s: string): string {
	return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

// Loads the shop's order statuses for the active store (cache-first, background refresh) so the
// order screen and filters show the real set (including custom statuses), and resolves each
// status label through the store's dictionary (locale + merchant overrides), preferring the
// app's own catalog over the connector's raw name so a non-localized shop keeps its language.
export function StatusesProvider({ children }: { children: ReactNode }) {
	const { client, active, cache } = useStores();
	const { t } = useI18n();
	const hk = useHk();
	const [statuses, setStatuses] = useState<OrderStatusDef[]>([]);

	useEffect(() => {
		if (!client || !active) { setStatuses([]); return; }
		const storeId = active.id;
		let alive = true;
		void (async () => {
			const cached = await cache.getStatuses(storeId);
			if (cached && alive) setStatuses(cached.data);
			try {
				const s = await client.getStatuses();
				if (!alive) return;
				setStatuses(s);
				await cache.putStatuses(storeId, s);
			} catch { /* keep cached / empty; callers fall back to their own labels */ }
		})();
		return () => { alive = false; };
	}, [client, active, cache]);

	const byKey = useMemo(() => {
		const m: Record<string, OrderStatusDef> = {};
		for (const s of statuses) m[s.namekey] = s;
		return m;
	}, [statuses]);

	const statusLabel = useCallback((namekey: string) => {
		const def = byKey[namekey];
		const appKey = `status.${namekey}`;
		const appLabel = t(appKey);
		// Prefer the app's own localized label; otherwise the connector's name, then the key.
		const fallback = appLabel !== appKey ? appLabel : (def?.name || cap(namekey));
		// The dictionary (locale pack + merchant overrides) wins when it has the key.
		return def?.label_key ? hk(def.label_key, fallback) : fallback;
	}, [byKey, t, hk]);

	const statusColor = useCallback((namekey: string) => byKey[namekey]?.color || '', [byKey]);

	return <StatusesContext.Provider value={{ statuses, statusLabel, statusColor }}>{children}</StatusesContext.Provider>;
}

export function useStatuses(): StatusesValue {
	return useContext(StatusesContext);
}
