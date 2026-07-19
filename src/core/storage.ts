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
