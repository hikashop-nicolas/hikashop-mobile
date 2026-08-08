import { describe, it, expect, vi, beforeEach } from 'vitest';

// The plugin is native-only; drive it through a mock so the adapter's routing can be tested.
const native = { value: false };
const store = new Map<string, string>();
const fail = { onSet: false, onGet: false };

vi.mock('@capacitor/core', () => ({
	Capacitor: { isNativePlatform: () => native.value },
}));
vi.mock('@aparajita/capacitor-secure-storage', () => ({
	SecureStorage: {
		getItem: vi.fn(async (k: string) => {
			if (fail.onGet) throw new Error('keystore invalidated');
			return store.has(k) ? store.get(k)! : null;
		}),
		setItem: vi.fn(async (k: string, v: string) => {
			if (fail.onSet) throw new Error('keystore unavailable');
			store.set(k, v);
		}),
		removeItem: vi.fn(async (k: string) => { store.delete(k); }),
		keys: vi.fn(async () => [...store.keys()]),
	},
}));

import { SecureKeyValueStore } from './secure-store';
import { MemoryKeyValueStore } from '../core';

beforeEach(() => {
	native.value = false;
	store.clear();
	fail.onSet = false;
	fail.onGet = false;
});

describe('SecureKeyValueStore in a browser', () => {
	it('uses the fallback store, since a browser has no keystore', async () => {
		const fallback = new MemoryKeyValueStore();
		const s = new SecureKeyValueStore('hk.secret.', fallback);
		await s.set('token.s1', 'abc');
		expect(await s.get('token.s1')).toBe('abc');
		// Written through the fallback, unprefixed by the adapter (the fallback owns its prefix).
		expect(await fallback.get('token.s1')).toBe('abc');
		expect(store.size).toBe(0);
	});

	it('does not migrate, because the fallback already is the store', async () => {
		const old = new MemoryKeyValueStore();
		await old.set('token.s1', 'abc');
		const s = new SecureKeyValueStore('hk.secret.', new MemoryKeyValueStore());
		expect(await s.migrateFrom(old)).toBe(0);
		expect(await old.get('token.s1')).toBe('abc'); // untouched
	});
});

describe('SecureKeyValueStore on a device', () => {
	beforeEach(() => { native.value = true; });

	it('reads and writes through the keystore, not the fallback', async () => {
		const fallback = new MemoryKeyValueStore();
		const s = new SecureKeyValueStore('hk.secret.', fallback);
		await s.set('token.s1', 'abc');
		expect(store.get('hk.secret.token.s1')).toBe('abc');
		expect(await s.get('token.s1')).toBe('abc');
		expect(await fallback.get('token.s1')).toBeNull();
	});

	it('lists keys with the prefix stripped', async () => {
		const s = new SecureKeyValueStore('hk.secret.', new MemoryKeyValueStore());
		await s.set('token.s1', 'a');
		await s.set('token.s2', 'b');
		store.set('other.thing', 'c'); // another consumer of the keystore
		expect((await s.keys()).sort()).toEqual(['token.s1', 'token.s2']);
	});

	it('treats an unreadable keystore as a miss rather than throwing', async () => {
		const s = new SecureKeyValueStore('hk.secret.', new MemoryKeyValueStore());
		await s.set('token.s1', 'abc');
		fail.onGet = true; // e.g. keys invalidated by an OS restore
		expect(await s.get('token.s1')).toBeNull();
	});

	it('moves tokens out of the insecure store and deletes the originals', async () => {
		const old = new MemoryKeyValueStore();
		await old.set('token.s1', 'abc');
		await old.set('token.s2', 'def');
		const s = new SecureKeyValueStore('hk.secret.', new MemoryKeyValueStore());

		expect(await s.migrateFrom(old)).toBe(2);
		expect(await s.get('token.s1')).toBe('abc');
		expect(await old.get('token.s1')).toBeNull();
		expect(await old.keys()).toEqual([]);
	});

	it('keeps the original token when the secure write fails, so the device stays paired', async () => {
		const old = new MemoryKeyValueStore();
		await old.set('token.s1', 'abc');
		const s = new SecureKeyValueStore('hk.secret.', new MemoryKeyValueStore());
		fail.onSet = true;

		expect(await s.migrateFrom(old)).toBe(0);
		expect(await old.get('token.s1')).toBe('abc');
	});
});
