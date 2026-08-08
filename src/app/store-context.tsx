import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { StoreRegistry, WebKeyValueStore, ApiClient, CacheRepository, parseNotifySettings } from '../core';
import type { Store, NotifySettings } from '../core';
import { notifier } from './notifier';

// One registry for the whole app: store metadata in the data namespace, tokens in the secrets one.
const registry = new StoreRegistry(new WebKeyValueStore('hk.data.'), new WebKeyValueStore('hk.secret.'));
// Read-model cache lives in its own namespace so clearing it never touches metadata or tokens.
const cache = new CacheRepository(new WebKeyValueStore('hk.cache.'));

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
