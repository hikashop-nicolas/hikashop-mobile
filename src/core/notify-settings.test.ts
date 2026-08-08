import { describe, it, expect } from 'vitest';
import {
	DEFAULT_NOTIFY_SETTINGS, clampThreshold, parseNotifySettings,
	newLowStock, nextSeen, lowStockKey, type LowStockItem,
} from './notify-settings';

const item = (over: Partial<LowStockItem> = {}): LowStockItem =>
	({ id: 1, variant_id: 0, name: 'P', code: 'C', quantity: 3, ...over });

describe('clampThreshold', () => {
	it('keeps sane values and truncates', () => {
		expect(clampThreshold(5)).toBe(5);
		expect(clampThreshold(4.7)).toBe(4);
	});
	it('clamps out-of-range values', () => {
		expect(clampThreshold(-3)).toBe(0);
		expect(clampThreshold(5000)).toBe(999);
	});
	it('falls back on non-numbers', () => {
		expect(clampThreshold(NaN)).toBe(DEFAULT_NOTIFY_SETTINGS.lowStockThreshold);
	});
});

describe('parseNotifySettings', () => {
	it('returns defaults for null or malformed input', () => {
		expect(parseNotifySettings(null)).toEqual(DEFAULT_NOTIFY_SETTINGS);
		expect(parseNotifySettings('not json')).toEqual(DEFAULT_NOTIFY_SETTINGS);
		expect(parseNotifySettings('"a string"')).toEqual(DEFAULT_NOTIFY_SETTINGS);
	});
	it('merges a partial payload onto the defaults', () => {
		expect(parseNotifySettings('{"lowStock":true}')).toEqual({ ...DEFAULT_NOTIFY_SETTINGS, lowStock: true });
	});
	it('clamps a stored threshold', () => {
		expect(parseNotifySettings('{"lowStockThreshold":-2}').lowStockThreshold).toBe(0);
	});
	it('ignores wrongly typed fields', () => {
		expect(parseNotifySettings('{"sound":"yes"}').sound).toBe(DEFAULT_NOTIFY_SETTINGS.sound);
	});
});

describe('lowStockKey', () => {
	it('distinguishes a variant from its parent product', () => {
		expect(lowStockKey(item({ id: 7, variant_id: 0 }))).toBe('p7');
		expect(lowStockKey(item({ id: 7, variant_id: 9 }))).toBe('v9');
	});
});

describe('newLowStock', () => {
	it('alerts for an item never seen before', () => {
		expect(newLowStock([item({ quantity: 2 })], {}).length).toBe(1);
	});
	it('stays quiet when the quantity has not changed', () => {
		expect(newLowStock([item({ quantity: 2 })], { p1: 2 })).toEqual([]);
	});
	it('alerts again when the stock drops further', () => {
		expect(newLowStock([item({ quantity: 1 })], { p1: 2 }).length).toBe(1);
	});
	it('stays quiet when the stock went up but is still low', () => {
		expect(newLowStock([item({ quantity: 4 })], { p1: 2 })).toEqual([]);
	});
});

describe('nextSeen', () => {
	it('records each item at its current quantity', () => {
		expect(nextSeen([item({ id: 1, quantity: 2 }), item({ id: 2, variant_id: 5, quantity: 0 })]))
			.toEqual({ p1: 2, v5: 0 });
	});
	it('drops items that are no longer low, so they alert again if they fall back', () => {
		expect(nextSeen([])).toEqual({});
	});
});
