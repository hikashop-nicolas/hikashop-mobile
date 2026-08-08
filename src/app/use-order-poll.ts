import { useEffect, useRef } from 'react';
import type { ApiClient, Store, NotifySettings } from '../core';
import { maxOrderId, newOrdersSince, newLowStock, nextSeen } from '../core';
import { notifier } from './notifier';
import { playChime } from './chime';
import type { TFunc } from '../i18n';

// Foreground polling: while a store is active and notifications are enabled, poll the site's own
// endpoints on an interval and whenever the app regains focus, raising a local notification for
// each new order and for stock that has fallen to the configured threshold. Native background
// polling (WorkManager / a foreground service) is a later, platform-specific addition (D5).

const POLL_MS = 30_000;
const cursorKey = (storeId: string) => `hk.notify.cursor.${storeId}`;
const lowStockKeyFor = (storeId: string) => `hk.notify.lowstock.${storeId}`;

export function useOrderPoll(
	client: ApiClient | null,
	store: Store | null,
	enabled: boolean,
	t: TFunc,
	settings: NotifySettings,
	onNew?: (count: number) => void,
): void {
	const onNewRef = useRef(onNew);
	onNewRef.current = onNew;
	const tRef = useRef(t);
	tRef.current = t;
	// Kept in a ref so changing a preference does not tear down and restart the poll loop.
	const settingsRef = useRef(settings);
	settingsRef.current = settings;

	useEffect(() => {
		if (!client || !store || !enabled) return;
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const key = cursorKey(store.id);
		const readCursor = () => Number(localStorage.getItem(key) || '0');
		const writeCursor = (v: number) => localStorage.setItem(key, String(v));

		const pollOrders = async () => {
			const s = settingsRef.current;
			if (!s.newOrders) return;
			const page = await client.getOrders({ limit: 20 });
			if (cancelled) return;
			const cursor = readCursor();
			if (cursor === 0) {
				// First run for this store: baseline the cursor, don't alert for existing orders.
				writeCursor(maxOrderId(page.items));
				return;
			}
			const fresh = newOrdersSince(page.items, cursor);
			if (!fresh.length) return;
			for (const o of fresh) {
				await notifier.show({
					title: tRef.current('notify.newOrder', { number: o.number }),
					body: `${o.customer.name || o.customer.email || tRef.current('common.guest')} · ${o.total.toFixed(2)}`,
					tag: `order-${o.id}`,
				});
			}
			if (s.sound) void playChime();
			writeCursor(Math.max(cursor, maxOrderId(page.items)));
			onNewRef.current?.(fresh.length);
		};

		const pollLowStock = async () => {
			const s = settingsRef.current;
			if (!s.lowStock) return;
			const items = await client.getLowStock({ threshold: s.lowStockThreshold, limit: 20 });
			if (cancelled) return;
			const seenKey = lowStockKeyFor(store.id);
			let seen: Record<string, number> = {};
			try { seen = JSON.parse(localStorage.getItem(seenKey) || '{}') as Record<string, number>; } catch { seen = {}; }
			const fresh = newLowStock(items, seen);
			for (const i of fresh) {
				await notifier.show({
					title: tRef.current('notify.lowStock'),
					body: tRef.current('notify.lowStockBody', { name: i.name, count: i.quantity }),
					tag: `stock-${i.variant_id || i.id}`,
				});
			}
			// Record every current item (not just the fresh ones) so recovered stock alerts again.
			localStorage.setItem(seenKey, JSON.stringify(nextSeen(items)));
		};

		const poll = async () => {
			// One failing check must not stop the other, and a failed poll is non-fatal either way.
			await Promise.allSettled([pollOrders(), pollLowStock()]);
			if (!cancelled) timer = setTimeout(poll, POLL_MS);
		};

		void poll();
		const onVisible = () => {
			if (document.visibilityState === 'visible') void poll();
		};
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, [client, store, enabled]);
}
