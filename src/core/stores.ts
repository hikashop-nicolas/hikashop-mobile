// The registry of stores the app is paired with. Store metadata lives in the data KV; each
// store's device token lives in the secrets KV (never together). Multi-store from day one.

import type { Store } from './models';
import type { KeyValueStore } from './storage';

const REGISTRY_KEY = 'stores';
const ACTIVE_KEY = 'activeStore';
const tokenKey = (id: string) => `token.${id}`;

function newId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	return 's_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class StoreRegistry {
	private data: KeyValueStore;
	private secrets: KeyValueStore;

	constructor(data: KeyValueStore, secrets: KeyValueStore) {
		this.data = data;
		this.secrets = secrets;
	}

	async list(): Promise<Store[]> {
		const raw = await this.data.get(REGISTRY_KEY);
		if (!raw) return [];
		try {
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? (parsed as Store[]) : [];
		} catch {
			return [];
		}
	}

	private async save(stores: Store[]): Promise<void> {
		await this.data.set(REGISTRY_KEY, JSON.stringify(stores));
	}

	async add(store: Omit<Store, 'id' | 'createdAt'> & { id?: string }, token: string): Promise<Store> {
		const stores = await this.list();
		const id = store.id ?? newId();
		const full: Store = { ...store, id, createdAt: Date.now() };
		stores.push(full);
		await this.save(stores);
		await this.secrets.set(tokenKey(id), token);
		if (stores.length === 1) await this.setActive(id);
		return full;
	}

	async remove(id: string): Promise<void> {
		const stores = (await this.list()).filter((s) => s.id !== id);
		await this.save(stores);
		await this.secrets.remove(tokenKey(id));
		if ((await this.getActiveId()) === id) {
			await this.setActive(stores.length ? stores[0].id : null);
		}
	}

	async get(id: string): Promise<Store | null> {
		return (await this.list()).find((s) => s.id === id) ?? null;
	}

	async token(id: string): Promise<string | null> {
		return this.secrets.get(tokenKey(id));
	}

	async getActiveId(): Promise<string | null> {
		return this.data.get(ACTIVE_KEY);
	}

	async setActive(id: string | null): Promise<void> {
		if (id) await this.data.set(ACTIVE_KEY, id);
		else await this.data.remove(ACTIVE_KEY);
	}

	async getActive(): Promise<Store | null> {
		const id = await this.getActiveId();
		return id ? this.get(id) : null;
	}
}
