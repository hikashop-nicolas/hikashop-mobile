import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { StoreRegistry, WebKeyValueStore, IdbKeyValueStore, ApiClient, CacheRepository, parseNotifySettings } from '../core';
import type { Store, NotifySettings } from '../core';
import { notifier } from './notifier';
import { SecureKeyValueStore } from './secure-store';
import { hostOf } from './utils';

// One registry for the whole app: store metadata in the data namespace, tokens in the secrets one.
// Tokens are store-admin credentials, so on a native build they live in the platform keystore;
// in the browser there is nothing better than localStorage, which the fallback provides.
const legacySecretStore = new WebKeyValueStore('hk.secret.');
const secretStore = new SecureKeyValueStore('hk.secret.', legacySecretStore);
const registry = new StoreRegistry(new WebKeyValueStore('hk.data.'), secretStore);
// Read-model cache lives in its own namespace so clearing it never touches metadata or tokens.
// It is backed by IndexedDB: the cached dictionaries and lists outgrow localStorage's ~5MB, and
// its synchronous API would block the UI thread on every read. Metadata and tokens stay in
// localStorage (small, and the tokens belong in the platform keystore, not a shared database).
const legacyCacheStore = new WebKeyValueStore('hk.cache.');
const cacheStore = new IdbKeyValueStore('hikashop-cache', legacyCacheStore);
const cache = new CacheRepository(cacheStore);

// One-time housekeeping: adopt anything an older localStorage-backed build left behind, then
// keep the cache bounded so a long-lived install cannot grow without limit.
const MAX_CACHE_ENTRIES = 300;
const cacheReady = (async () => {
	try {
		// Tokens first: a paired device must not appear unpaired if the cache work is slow.
		await secretStore.migrateFrom(legacySecretStore);
		await cacheStore.migrateFrom(legacyCacheStore);
		await cache.pruneTo(MAX_CACHE_ENTRIES);
	} catch { /* housekeeping is best-effort */ }
})();

const NOTIFY_PREF_KEY = 'hk.notify.enabled';
const NOTIFY_SETTINGS_KEY = 'hk.notify.settings';

interface StoreContextValue {
	ready: boolean;
	stores: Store[];
	active: Store | null;
	client: ApiClient | null;
	registry: StoreRegistry;
	cache: CacheRepository;
	notifyEnabled: boolean;
	notifySupported: boolean;
	notifySettings: NotifySettings;
	setNotifySettings: (s: NotifySettings) => void;
	enableNotifications: () => Promise<boolean>;
	disableNotifications: () => void;
	refresh: () => Promise<void>;
	setActive: (id: string) => Promise<void>;
	remove: (id: string) => Promise<void>;
}

// Exported so tests can provide a mock store context (e.g. a fake ApiClient).
export const StoreContext = createContext<StoreContextValue | null>(null);

export function useStores(): StoreContextValue {
	const ctx = useContext(StoreContext);
	if (!ctx) throw new Error('useStores must be used within a StoreProvider');
	return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
	const [ready, setReady] = useState(false);
	const [stores, setStores] = useState<Store[]>([]);
	const [active, setActiveStore] = useState<Store | null>(null);
	const [client, setClient] = useState<ApiClient | null>(null);
	// Notifications are on only when the user opted in AND the OS permission is granted.
	const [notifyEnabled, setNotifyEnabled] = useState(
		() => localStorage.getItem(NOTIFY_PREF_KEY) === '1' && notifier.permission() === 'granted',
	);

	const enableNotifications = useCallback(async () => {
		const granted = await notifier.requestPermission();
		if (granted) {
			localStorage.setItem(NOTIFY_PREF_KEY, '1');
			setNotifyEnabled(true);
		}
		return granted;
	}, []);

	const disableNotifications = useCallback(() => {
		localStorage.removeItem(NOTIFY_PREF_KEY);
		setNotifyEnabled(false);
	}, []);

	// Per-device alerting preferences (which events, threshold, sound).
	const [notifySettings, setNotifySettingsState] = useState<NotifySettings>(
		() => parseNotifySettings(localStorage.getItem(NOTIFY_SETTINGS_KEY)),
	);
	const setNotifySettings = useCallback((next: NotifySettings) => {
		localStorage.setItem(NOTIFY_SETTINGS_KEY, JSON.stringify(next));
		setNotifySettingsState(next);
	}, []);

	const refresh = useCallback(async () => {
		await cacheReady;
		const list = await registry.list();
		const act = await registry.getActive();
		setStores(list);
		setActiveStore(act);
		if (act) {
			const token = await registry.token(act.id);
			setClient(new ApiClient(act.baseUrl, token));
		} else {
			setClient(null);
		}
		setReady(true);
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	// Pairing reads /site once and the record then never changes, so a shop that since set a logo,
	// promoted the operator or installed HikaMarket would keep showing the app what was true the
	// day it was paired. Re-read it once per store per app start, and only write when something
	// actually differs so this does not turn into a refresh loop.
	const synced = useRef<Set<string>>(new Set());
	useEffect(() => {
		if (!client || !active || synced.current.has(active.id)) return;
		const store = active;
		synced.current.add(store.id);
		let alive = true;
		void client.getSite().then(async (site) => {
			if (!alive) return;
			const patch = {
				// A shop that has since been renamed, or was paired before the connector reported
				// its name at all. Its address remains the fallback.
				name: site.site_name?.trim() || hostOf(store.baseUrl),
				logo: site.logo ?? '',
				role: site.operator?.role ?? store.role,
				capabilities: site.capabilities,
				permissions: site.permissions,
			};
			const same = patch.name === store.name
				&& patch.logo === (store.logo ?? '')
				&& patch.role === store.role
				&& JSON.stringify(patch.capabilities) === JSON.stringify(store.capabilities)
				&& JSON.stringify(patch.permissions) === JSON.stringify(store.permissions);
			if (same) return;
			await registry.update(store.id, patch);
			await refresh();
		}).catch(() => { /* offline, or an old connector: keep what pairing captured */ });
		return () => { alive = false; };
	}, [client, active, refresh]);

	const setActive = useCallback(async (id: string) => {
		await registry.setActive(id);
		await refresh();
	}, [refresh]);

	const remove = useCallback(async (id: string) => {
		await registry.remove(id);
		await cache.clearStore(id);
		await refresh();
	}, [refresh]);

	return (
		<StoreContext.Provider value={{
			ready, stores, active, client, registry, cache,
			notifyEnabled, notifySupported: notifier.supported, enableNotifications, disableNotifications,
			notifySettings, setNotifySettings,
			refresh, setActive, remove,
		}}>
			{children}
		</StoreContext.Provider>
	);
}
