import { describe, it, expect } from 'vitest';
import { StoreRegistry } from './stores';
import { MemoryKeyValueStore } from './storage';

const reg = () => new StoreRegistry(new MemoryKeyValueStore(), new MemoryKeyValueStore());

describe('StoreRegistry', () => {
	it('adds a store, keeps its token in the secrets store, and makes the first one active', async () => {
		const r = reg();
		const s = await r.add({ name: 'My Shop', baseUrl: 'http://shop', role: 'admin' }, 'TOK');
		expect((await r.list()).length).toBe(1);
		expect(await r.token(s.id)).toBe('TOK');
		expect((await r.getActive())?.id).toBe(s.id);
	});

	it('supports multiple stores and switching the active one', async () => {
		const r = reg();
		const a = await r.add({ name: 'A', baseUrl: 'http://a', role: 'admin' }, 'ta');
		const b = await r.add({ name: 'B', baseUrl: 'http://b', role: 'staff' }, 'tb');
		expect((await r.getActive())?.id).toBe(a.id);
		await r.setActive(b.id);
		expect((await r.getActive())?.id).toBe(b.id);
	});

	it('removing the active store drops its token and falls back to another', async () => {
		const r = reg();
		const a = await r.add({ name: 'A', baseUrl: 'http://a', role: 'admin' }, 'ta');
		const b = await r.add({ name: 'B', baseUrl: 'http://b', role: 'staff' }, 'tb');
		await r.setActive(a.id);
		await r.remove(a.id);
		expect(await r.token(a.id)).toBeNull();
		expect((await r.list()).length).toBe(1);
		expect((await r.getActive())?.id).toBe(b.id);
	});

	it('returns an empty list and no active store when nothing is paired', async () => {
		const r = reg();
		expect(await r.list()).toEqual([]);
		expect(await r.getActive()).toBeNull();
	});
});
