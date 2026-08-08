import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { KeyValueStore } from '../core';

// Device tokens are store-admin credentials: whoever holds one can read and change the shop.
// On a native build they belong in the platform keystore (EncryptedSharedPreferences on Android,
// Keychain on iOS), not in localStorage, which is plain text and can be swept into a device
// backup. A browser has no keystore, so the PWA keeps using the injected fallback: same
// interface, best available storage per platform.
export class SecureKeyValueStore implements KeyValueStore {
	private prefix: string;
	private fallback: KeyValueStore;

	constructor(prefix: string, fallback: KeyValueStore) {
		this.prefix = prefix;
		this.fallback = fallback;
	}

	// Only native platforms have a keystore to use.
	private get secure(): boolean {
		return Capacitor.isNativePlatform();
	}

	async get(key: string): Promise<string | null> {
		if (!this.secure) return this.fallback.get(key);
		try {
			return await SecureStorage.getItem(this.prefix + key);
		} catch {
			// A keystore read can fail after an OS restore invalidated the keys; treat it as a miss
			// so the app asks the operator to pair again rather than crashing on launch.
			return null;
		}
	}

	async set(key: string, value: string): Promise<void> {
		if (!this.secure) return this.fallback.set(key, value);
		await SecureStorage.setItem(this.prefix + key, value);
	}

	async remove(key: string): Promise<void> {
		if (!this.secure) return this.fallback.remove(key);
		try {
			await SecureStorage.removeItem(this.prefix + key);
		} catch {
			// already gone
		}
	}

	async keys(): Promise<string[]> {
		if (!this.secure) return this.fallback.keys();
		try {
			const all = await SecureStorage.keys();
			return all.filter((k) => k.startsWith(this.prefix)).map((k) => k.slice(this.prefix.length));
		} catch {
			return [];
		}
	}

	// Move tokens written by an earlier build out of the insecure store and delete the originals.
	// Only meaningful on native; in the browser the fallback already is the store. Returns how
	// many were moved. Safe to call on every start: a no-op once the old store is empty.
	async migrateFrom(old: KeyValueStore): Promise<number> {
		if (!this.secure) return 0;
		let moved = 0;
		for (const key of await old.keys()) {
			const value = await old.get(key);
			if (value === null) continue;
			try {
				await this.set(key, value);
				await old.remove(key);
				moved++;
			} catch {
				// Leave the remaining tokens where they are rather than losing them; the operator
				// stays paired and the next start retries.
				break;
			}
		}
		return moved;
	}
}
