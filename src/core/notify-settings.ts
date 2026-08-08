// Notification preferences (master-plan D5 tier 1: local notifications, no server infra).
// Stored per device, not per store, so the operator configures alerting once.

export interface NotifySettings {
	newOrders: boolean;
	lowStock: boolean;
	lowStockThreshold: number;
	sound: boolean;
}

export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
	newOrders: true,
	lowStock: false,
	lowStockThreshold: 5,
	sound: true,
};

// Clamp a threshold to a sane range: 0 means "only alert when it hits zero".
export function clampThreshold(n: number): number {
	if (!Number.isFinite(n)) return DEFAULT_NOTIFY_SETTINGS.lowStockThreshold;
	return Math.min(999, Math.max(0, Math.trunc(n)));
}

// Merge stored JSON (possibly from an older app version, possibly malformed) onto the defaults.
export function parseNotifySettings(raw: string | null): NotifySettings {
	if (!raw) return { ...DEFAULT_NOTIFY_SETTINGS };
	try {
		const p = JSON.parse(raw) as Partial<NotifySettings>;
		if (!p || typeof p !== 'object') return { ...DEFAULT_NOTIFY_SETTINGS };
		return {
			newOrders: typeof p.newOrders === 'boolean' ? p.newOrders : DEFAULT_NOTIFY_SETTINGS.newOrders,
			lowStock: typeof p.lowStock === 'boolean' ? p.lowStock : DEFAULT_NOTIFY_SETTINGS.lowStock,
			lowStockThreshold: typeof p.lowStockThreshold === 'number'
				? clampThreshold(p.lowStockThreshold)
				: DEFAULT_NOTIFY_SETTINGS.lowStockThreshold,
			sound: typeof p.sound === 'boolean' ? p.sound : DEFAULT_NOTIFY_SETTINGS.sound,
		};
	} catch {
		return { ...DEFAULT_NOTIFY_SETTINGS };
	}
}

// Which low-stock items are worth alerting about now: those at or below the threshold that we
// have not already alerted for at their current quantity. The seen map is {itemKey: quantity},
// so a product that drops further (5 → 2) alerts again, while an unchanged one stays quiet.
export interface LowStockItem {
	id: number;
	variant_id: number;
	name: string;
	code: string;
	quantity: number;
}

export function lowStockKey(i: LowStockItem): string {
	return i.variant_id > 0 ? `v${i.variant_id}` : `p${i.id}`;
}

export function newLowStock(items: LowStockItem[], seen: Record<string, number>): LowStockItem[] {
	return items.filter((i) => {
		const prev = seen[lowStockKey(i)];
		return prev === undefined || i.quantity < prev;
	});
}

// The seen map after alerting: every current item recorded at its present quantity, and items
// that recovered above the threshold dropped so they alert again if they fall back.
export function nextSeen(items: LowStockItem[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const i of items) out[lowStockKey(i)] = i.quantity;
	return out;
}
