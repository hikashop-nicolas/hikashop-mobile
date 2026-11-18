import { describe, it, expect } from 'vitest';
import { b64uToBytes, sameKey, subscriptionBody } from './web-push';
import { DEFAULT_NOTIFY_SETTINGS } from '../core';

const texts = { new_order: 'New order #{number}', low_stock: 'Low stock', low_stock_body: '{name}: {count} left', guest: 'Guest' };

describe('web push helpers', () => {
	it('decodes a base64url key, padding included', () => {
		expect(Array.from(b64uToBytes('_-8'))).toEqual([0xff, 0xef]);
	});

	it('tells whether a subscription was made with the shop key', () => {
		const key = new Uint8Array([4, 1, 2]);
		expect(sameKey(new Uint8Array([4, 1, 2]).buffer, key)).toBe(true);
		expect(sameKey(new Uint8Array([4, 1, 3]).buffer, key)).toBe(false);
		expect(sameKey(null, key)).toBe(false);
	});

	it('sends the alert preferences with the subscription', () => {
		const body = subscriptionBody(
			{ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'p', auth: 'a' } },
			{ ...DEFAULT_NOTIFY_SETTINGS, lowStock: true, lowStockThreshold: 3 },
			texts,
		);
		expect(body?.prefs).toEqual({ new_orders: true, low_stock: true, threshold: 3 });
		expect(body?.keys).toEqual({ p256dh: 'p', auth: 'a' });
	});

	it('refuses a subscription without its keys', () => {
		expect(subscriptionBody({ endpoint: 'https://x' }, DEFAULT_NOTIFY_SETTINGS, texts)).toBeNull();
	});
});
