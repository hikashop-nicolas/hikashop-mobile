import { Capacitor } from '@capacitor/core';
import type { ApiClient, NotifySettings, PushSubscriptionBody } from '../core';

// Web Push (master-plan D5 tier 2): the shop itself pushes to this browser, so alerts arrive with
// the app closed, iPhone home-screen apps included. One push worker registration per shop, since
// a subscription is bound to one VAPID key and each shop signs with its own.

export type PushTexts = PushSubscriptionBody['texts'];

const base = (): string => import.meta.env.BASE_URL || '/';
const scopeFor = (storeId: string) => `${base()}push/${encodeURIComponent(storeId)}/`;

// The installed or browser web app; the native shell keeps its own polling.
export function webPushSupported(): boolean {
	return typeof window !== 'undefined'
		&& !Capacitor.isNativePlatform()
		&& 'serviceWorker' in navigator
		&& 'PushManager' in window
		&& 'Notification' in window;
}

// iOS only offers notifications to a web app added to the Home Screen.
export function needsHomeScreen(): boolean {
	if (typeof navigator === 'undefined') return false;
	const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
		|| (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
	const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true
		|| (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches);
	return ios && !standalone;
}

export function b64uToBytes(s: string): Uint8Array<ArrayBuffer> {
	const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
	const bin = atob(b64);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

export function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
	if (!a || a.byteLength !== b.length) return false;
	const v = new Uint8Array(a);
	return v.every((x, i) => x === b[i]);
}

export function subscriptionBody(sub: PushSubscriptionJSON, s: NotifySettings, texts: PushTexts): PushSubscriptionBody | null {
	if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return null;
	return {
		endpoint: sub.endpoint,
		keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
		prefs: { new_orders: s.newOrders, low_stock: s.lowStock, threshold: s.lowStockThreshold },
		texts,
	};
}

async function activeRegistration(storeId: string): Promise<ServiceWorkerRegistration> {
	const reg = await navigator.serviceWorker.register(`${base()}push-sw.js`, { scope: scopeFor(storeId) });
	if (reg.active) return reg;
	const worker = reg.installing ?? reg.waiting;
	await new Promise<void>((resolve) => {
		if (!worker) { resolve(); return; }
		worker.addEventListener('statechange', () => { if (worker.state === 'activated') resolve(); });
	});
	return reg;
}

// Subscribe this browser to one shop and tell the shop what to send. Returns false when the shop
// cannot push (an older connector, or a server without the crypto it needs).
export async function subscribeStore(client: ApiClient, storeId: string, s: NotifySettings, texts: PushTexts): Promise<boolean> {
	const key = await client.getPushKey().catch(() => null);
	if (!key?.available || !key.public_key) return false;
	const serverKey = b64uToBytes(key.public_key);
	const reg = await activeRegistration(storeId);
	let sub = await reg.pushManager.getSubscription();
	// The shop's key changed (a restored site, a new install): the old subscription is useless.
	if (sub && !sameKey(sub.options.applicationServerKey, serverKey)) {
		await sub.unsubscribe().catch(() => false);
		sub = null;
	}
	sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey });
	const body = subscriptionBody(sub.toJSON(), s, texts);
	if (!body) return false;
	await client.putPushSubscription(body);
	return true;
}

// Stop one shop's pushes: tell the shop when it can still be reached, then drop the browser side.
export async function unsubscribeStore(client: ApiClient | null, storeId: string): Promise<void> {
	const reg = await navigator.serviceWorker.getRegistration(scopeFor(storeId));
	if (!reg || !reg.scope.endsWith(`/push/${encodeURIComponent(storeId)}/`)) return;
	const sub = await reg.pushManager.getSubscription();
	if (sub) {
		if (client) await client.deletePushSubscription(sub.endpoint).catch(() => {});
		// Once unsubscribed the endpoint answers 410, and the shop forgets it on its next send.
		await sub.unsubscribe().catch(() => false);
	}
	await reg.unregister().catch(() => false);
}

// Push registrations left behind by shops this device is no longer paired with.
export async function orphanStoreIds(known: string[]): Promise<string[]> {
	const prefix = new URL(`${base()}push/`, location.href).href;
	const out: string[] = [];
	for (const reg of await navigator.serviceWorker.getRegistrations()) {
		if (!reg.scope.startsWith(prefix)) continue;
		const id = decodeURIComponent(reg.scope.slice(prefix.length).replace(/\/$/, ''));
		if (id && !known.includes(id)) out.push(id);
	}
	return out;
}
