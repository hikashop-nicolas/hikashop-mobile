import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useStores } from './store-context';
import { useI18n } from '../i18n';

// Map the app's short locale to the HikaShop language tag the store installs its packs under.
const TAG: Record<string, string> = { en: 'en-GB', fr: 'fr-FR' };

export interface Versions { i18n: string; statuses: string }

const VersionsContext = createContext<{ versions: Versions | null; tag: string }>({ versions: null, tag: 'en-GB' });

// Fetches the cheap change tokens once per store + locale and shares them, so the dictionary
// and statuses providers can decide whether their cached payload is still current without each
// hitting /version separately.
export function VersionsProvider({ children }: { children: ReactNode }) {
	const { client, active } = useStores();
	const { locale } = useI18n();
	const tag = TAG[locale] ?? 'en-GB';
	const [versions, setVersions] = useState<Versions | null>(null);

	useEffect(() => {
		setVersions(null);
		if (!client || !active) return;
		let alive = true;
		void (async () => {
			try { const v = await client.getVersion(tag); if (alive) setVersions(v); }
			catch { /* leave null: consumers keep their cached payloads */ }
		})();
		return () => { alive = false; };
	}, [client, active, tag]);

	return <VersionsContext.Provider value={{ versions, tag }}>{children}</VersionsContext.Provider>;
}

export function useVersions(): { versions: Versions | null; tag: string } {
	return useContext(VersionsContext);
}
