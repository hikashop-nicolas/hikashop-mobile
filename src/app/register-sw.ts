import { Capacitor } from '@capacitor/core';

// The service worker exists for the PWA, where it makes the app installable and available
// offline. The native shell already serves every asset from the app bundle, so a worker buys
// it nothing -- and costs something real: its precache survives an app update, so the WebView
// keeps serving the previous build's assets after the new APK is installed. That is exactly
// what happened when the app kept rendering the old accent colour after an update.
//
// So: register it on the web, and on a device make sure any worker left by an earlier build is
// removed and its caches dropped, otherwise devices that already have one stay stuck.
export async function registerServiceWorker(): Promise<void> {
	if (!('serviceWorker' in navigator)) return;

	if (Capacitor.isNativePlatform()) {
		await unregisterAll();
		return;
	}

	// BASE_URL, not '/', so a build hosted on a subpath registers the right worker and scope.
	const base = import.meta.env.BASE_URL || '/';
	try {
		await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
	} catch {
		// An unavailable worker only costs offline support; the app still runs.
	}
}

async function unregisterAll(): Promise<void> {
	try {
		for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
		if ('caches' in window) {
			for (const key of await caches.keys()) await caches.delete(key);
		}
	} catch {
		// nothing to clean up, or storage is unavailable
	}
}
