import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useStores } from './store-context';
import { LOCALES, useI18n } from '../i18n';

// The tag the store installs its language pack under. The app's locales are HikaShop's own tags
// already (ja-JP, de-DE); only the two written by hand here are short. A tag the connector will
// not parse (nl-NL-flemish) asks under the fuller sibling it already reads from.
const SHORT: Record<string, string> = { en: 'en-GB', fr: 'fr-FR' };

export function hikaTag(locale: string): string {
	for (let t: string | undefined = locale; t; t = LOCALES[t]?.base) {
		if (SHORT[t]) return SHORT[t];
		if (/^[a-z]{2,3}-[A-Z]{2}$/.test(t)) return t;
	}
	return 'en-GB';
}

export interface Versions { i18n: string; statuses: string }

const VersionsContext = createContext<{ versions: Versions | null; tag: string }>({ versions: null, tag: 'en-GB' });

// Fetches the cheap change tokens once per store + locale and shares them, so the dictionary
// and statuses providers can decide whether their cached payload is still current without each
// hitting /version separately.
export function VersionsProvider({ children }: { children: ReactNode }) {
	const { client, active } = useStores();
	const { locale } = useI18n();
	const tag = hikaTag(locale);
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
