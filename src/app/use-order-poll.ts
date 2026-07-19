import { useEffect, useRef } from 'react';
import type { ApiClient, Store } from '../core';
import { maxOrderId, newOrdersSince } from '../core';
import { notifier } from './notifier';

// Foreground order polling: while a store is active and notifications are enabled, poll the
// site's own /orders on an interval and whenever the app regains focus, and raise a local
// notification for each order newer than the last-seen cursor. Native background polling
// (WorkManager / a foreground service) is a later, platform-specific addition (D5).

const POLL_MS = 30_000;
const cursorKey = (storeId: string) => `hk.notify.cursor.${storeId}`;

export function useOrderPoll(
	client: ApiClient | null,
	store: Store | null,
	enabled: boolean,
	onNew?: (count: number) => void,
): void {
	const onNewRef = useRef(onNew);
	onNewRef.current = onNew;

	useEffect(() => {
		if (!client || !store || !enabled) return;
		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | null = null;
		const key = cursorKey(store.id);
		const readCursor = () => Number(localStorage.getItem(key) || '0');
		const writeCursor = (v: number) => localStorage.setItem(key, String(v));

		const poll = async () => {
			try {
				const page = await client.getOrders({ limit: 20 });
				if (cancelled) return;
				const cursor = readCursor();
				if (cursor === 0) {
					// First run for this store: baseline the cursor, don't alert for existing orders.
					writeCursor(maxOrderId(page.items));
				} else {
					const fresh = newOrdersSince(page.items, cursor);
					if (fresh.length) {
						for (const o of fresh) {
							await notifier.show({
								title: `New order #${o.number}`,
								body: `${o.customer.name || o.customer.email || 'Guest'} · ${o.total.toFixed(2)}`,
								tag: `order-${o.id}`,
							});
						}
						writeCursor(Math.max(cursor, maxOrderId(page.items)));
						onNewRef.current?.(fresh.length);
					}
				}
			} catch {
				// a failed poll is non-fatal; try again next tick
			}
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
