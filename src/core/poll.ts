// Pure helpers for local-notification polling (master-plan D5, tier 1): the app polls the
// site's own /orders and notifies for orders newer than the last-seen cursor. Order ids grow
// monotonically on creation, so the highest id seen is the cursor. No server infra, no secret.

import type { OrderSummary } from './models';

export function maxOrderId(orders: OrderSummary[]): number {
	return orders.reduce((m, o) => (o.id > m ? o.id : m), 0);
}

// Orders strictly newer than the cursor, oldest first (so notifications fire in order).
export function newOrdersSince(orders: OrderSummary[], lastOrderId: number): OrderSummary[] {
	return orders.filter((o) => o.id > lastOrderId).sort((a, b) => a.id - b.id);
}
