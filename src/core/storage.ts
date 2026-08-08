// Key/value storage abstraction. The app uses two instances: one for regular data (store
// registry, caches) and one for secrets (device tokens). Concrete adapters are chosen per
// platform (secure Keystore on native, browser storage in the PWA); tests use the in-memory one.

export interface KeyValueStore {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
	remove(key: string): Promise<void>;
	keys(): Promise<string[]>;
}

export class MemoryKeyValueStore implements KeyValueStore {
	private map = new Map<string, string>();
	async get(key: string) {
		return this.map.has(key) ? this.map.get(key)! : null;
	}
	async set(key: string, value: string) {
		this.map.set(key, value);
	}
	async remove(key: string) {
		this.map.delete(key);
	}
	async keys() {
		return [...this.map.keys()];
	}
}

// IndexedDB-backed store for the read cache. localStorage is capped around 5MB and is
// synchronous, so parsing a 265KB translation dictionary blocks the UI thread; IndexedDB is
// asynchronous and its quota is orders of magnitude larger. One implementation covers both the
// PWA and the Android WebView, so no native plugin is needed. If IndexedDB is unavailable
// (private mode, an old webview), every call falls back to localStorage.
export class IdbKeyValueStore implements KeyValueStore {
	private dbName: string;
	private storeName = 'kv';
	private fallback: KeyValueStore;
	private dbp: Promise<IDBDatabase | null> | null = null;

	constructor(dbName = 'hikashop-cache', fallback: KeyValueStore = new WebKeyValueStore('hk.cache.')) {
		this.dbName = dbName;
		this.fallback = fallback;
	}

	private open(): Promise<IDBDatabase | null> {
		if (this.dbp) return this.dbp;
		this.dbp = new Promise((resolve) => {
			if (typeof indexedDB === 'undefined') { resolve(null); return; }
			try {
				const req = indexedDB.open(this.dbName, 1);
				req.onupgradeneeded = () => {
					const db = req.result;
					if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName);
				};
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => resolve(null);
			} catch {
				resolve(null);
			}
		});
		return this.dbp;
	}

	private run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
		return this.open().then((db) => {
			if (!db) return null;
			return new Promise<T | null>((resolve, reject) => {
				let req: IDBRequest;
				try {
					req = fn(db.transaction(this.storeName, mode).objectStore(this.storeName));
				} catch (e) { reject(e); return; }
				req.onsuccess = () => resolve(req.result as T);
				req.onerror = () => reject(req.error);
			});
		});
	}

	async get(key: string): Promise<string | null> {
		const db = await this.open();
		if (!db) return this.fallback.get(key);
		const v = await this.run<string>('readonly', (s) => s.get(key));
		return v ?? null;
	}

	async set(key: string, value: string): Promise<void> {
		const db = await this.open();
		if (!db) return this.fallback.set(key, value);
		await this.run('readwrite', (s) => s.put(value, key));
	}

	async remove(key: string): Promise<void> {
		const db = await this.open();
		if (!db) return this.fallback.remove(key);
		await this.run('readwrite', (s) => s.delete(key));
	}

	async keys(): Promise<string[]> {
		const db = await this.open();
		if (!db) return this.fallback.keys();
		const ks = await this.run<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
		return (ks ?? []).map(String);
	}

	// Move any cache entries written by an earlier localStorage-backed build, then drop them so
	// the 5MB budget is freed. Safe to call on every start: it is a no-op once empty.
	async migrateFrom(old: KeyValueStore): Promise<number> {
		const db = await this.open();
		if (!db) return 0;
		const keys = await old.keys();
		let moved = 0;
		for (const k of keys) {
			const v = await old.get(k);
			if (v === null) continue;
			try {
				await this.set(k, v);
				await old.remove(k);
				moved++;
			} catch {
				break; // storage is unhappy; leave the rest where it is
			}
		}
		return moved;
	}
}

export class WebKeyValueStore implements KeyValueStore {
	private prefix: string;
	constructor(prefix = 'hk.') {
		this.prefix = prefix;
	}
	async get(key: string) {
		return localStorage.getItem(this.prefix + key);
	}
	async set(key: string, value: string) {
		localStorage.setItem(this.prefix + key, value);
	}
	async remove(key: string) {
		localStorage.removeItem(this.prefix + key);
	}
	async keys() {
		const out: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k && k.startsWith(this.prefix)) out.push(k.slice(this.prefix.length));
		}
		return out;
	}
}
