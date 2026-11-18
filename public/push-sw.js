// Push-only service worker, one registration per shop at <base>push/<store id>/, since a browser
// subscription is bound to one VAPID key and every shop signs with its own. The app's main worker
// (offline cache) is separate and untouched.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function where() {
	const scope = self.registration.scope;
	const m = scope.match(/^(.*\/)push\/([^/]+)\/$/);
	return m ? { root: m[1], store: decodeURIComponent(m[2]) } : { root: scope, store: '' };
}

self.addEventListener('push', (event) => {
	let data = {};
	try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
	const { root, store } = where();
	const path = typeof data.path === 'string' && data.path.startsWith('/') ? data.path : '/';
	const url = root + '#' + path + (store ? '?store=' + encodeURIComponent(store) : '');
	// iOS revokes a subscription whose pushes do not show a notification, so always show one.
	event.waitUntil(self.registration.showNotification(data.title || 'HikaShop', {
		body: data.body || '',
		tag: data.tag || undefined,
		icon: root + 'pwa-192x192.png',
		data: { url },
	}));
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = event.notification.data && event.notification.data.url;
	const { root } = where();
	event.waitUntil((async () => {
		const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
		const app = open.find((c) => c.url.startsWith(root));
		if (app) {
			// This worker does not control the page, so it asks the app to go there itself.
			app.postMessage({ type: 'hikashop-open', url });
			try { await app.focus(); return; } catch { /* fall back to a new window */ }
		}
		if (url) await self.clients.openWindow(url);
	})());
});
