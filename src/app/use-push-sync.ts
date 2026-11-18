import { useEffect, useState } from 'react';
import { ApiClient } from '../core';
import type { NotifySettings, Store, StoreRegistry } from '../core';
import type { TFunc } from '../i18n';
import { orphanStoreIds, subscribeStore, unsubscribeStore, webPushSupported } from './web-push';
import type { PushTexts } from './web-push';

// Keeps every paired shop's Web Push subscription in line with the alert settings. Returns the
// ids of the shops pushing to this browser, whose alerts the foreground poller then leaves alone.
export function usePushSync(
	stores: Store[],
	registry: StoreRegistry,
	enabled: boolean,
	settings: NotifySettings,
	t: TFunc,
): string[] {
	const [pushing, setPushing] = useState<string[]>([]);
	const texts: PushTexts = {
		new_order: t('notify.newOrder'),
		low_stock: t('notify.lowStock'),
		low_stock_body: t('notify.lowStockBody'),
		guest: t('common.guest'),
	};
	const textsKey = JSON.stringify(texts);
	const storesKey = stores.map((s) => `${s.id}:${s.capabilities?.push ? 1 : 0}`).join(',');
	const settingsKey = JSON.stringify(settings);

	useEffect(() => {
		if (!webPushSupported()) return;
		let cancelled = false;
		// Settings change a tap at a time; wait for the operator to stop before telling every shop.
		const timer = setTimeout(() => void (async () => {
			const wanted = enabled && (settings.newOrders || settings.lowStock) && Notification.permission === 'granted';
			const ok: string[] = [];
			for (const store of stores) {
				const token = await registry.token(store.id).catch(() => null);
				const client = token ? new ApiClient(store.baseUrl, token) : null;
				try {
					if (wanted && client && store.capabilities?.push) {
						if (await subscribeStore(client, store.id, settings, JSON.parse(textsKey) as PushTexts)) ok.push(store.id);
					} else {
						await unsubscribeStore(client, store.id);
					}
				} catch {
					// offline, or the browser refused: this shop falls back to polling
				}
			}
			for (const id of await orphanStoreIds(stores.map((s) => s.id)).catch(() => [])) {
				await unsubscribeStore(null, id).catch(() => {});
			}
			if (!cancelled) setPushing(ok);
		})(), 700);
		return () => { cancelled = true; clearTimeout(timer); };
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content, not identity
	}, [enabled, storesKey, settingsKey, textsKey, registry]);

	return pushing;
}
