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
		const reg = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
		watchForNewBuild(reg);
	} catch {
		// An unavailable worker only costs offline support; the app still runs.
	}
}

// An installed PWA is opened once and can then run for weeks. The worker updates itself in the
// background and takes over (the build is generated with skipWaiting), but the code already
// running in the tab is still the old one until something reloads it -- so a shop would go on
// using a build that was replaced days ago, and say the fix never arrived.
//
// So: ask for a new worker now and again, and reload once when one takes over.
const UPDATE_EVERY_MS = 60 * 60 * 1000;

function watchForNewBuild(reg: ServiceWorkerRegistration): void {
	// Once only. controllerchange also fires on the very first registration, when there is
	// nothing to pick up and a reload would be a loop.
	let reloading = false;
	if (navigator.serviceWorker.controller) {
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (reloading) return;
			reloading = true;
			window.location.reload();
		});
	}

	const check = () => { void reg.update().catch(() => { /* offline: try again later */ }); };
	setInterval(check, UPDATE_EVERY_MS);
	// And whenever it comes back to the foreground, which is when someone is about to use it.
	document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}

// The commit this bundle was built from, for the about line and for bug reports.
export function appBuild(): string {
	return typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';
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
