// Local notifications. The web implementation covers the PWA today; a Capacitor
// LocalNotifications implementation (for guaranteed native delivery + custom sound) slots in
// behind the same Notifier interface later. No server, no push token: master-plan D5 tier 1.

export interface AppNotification {
	title: string;
	body: string;
	tag?: string;
}

export type NotifyPermission = 'default' | 'granted' | 'denied';

export interface Notifier {
	readonly supported: boolean;
	permission(): NotifyPermission;
	requestPermission(): Promise<boolean>;
	show(n: AppNotification): Promise<void>;
}

const ICON = '/pwa-192x192.png';

class WebNotifier implements Notifier {
	get supported(): boolean {
		return typeof window !== 'undefined' && 'Notification' in window;
	}

	permission(): NotifyPermission {
		return this.supported ? (Notification.permission as NotifyPermission) : 'denied';
	}

	async requestPermission(): Promise<boolean> {
		if (!this.supported) return false;
		if (Notification.permission === 'granted') return true;
		if (Notification.permission === 'denied') return false;
		const p = await Notification.requestPermission();
		return p === 'granted';
	}

	async show(n: AppNotification): Promise<void> {
		if (!this.supported || Notification.permission !== 'granted') return;
		// The service worker registration shows persistent notifications (needed on mobile);
		// fall back to a page-level Notification when no SW controls the page.
		try {
			const reg = await navigator.serviceWorker?.getRegistration();
			if (reg) {
				await reg.showNotification(n.title, { body: n.body, tag: n.tag, icon: ICON });
				return;
			}
		} catch {
			// fall through to the page Notification
		}
		new Notification(n.title, { body: n.body, tag: n.tag, icon: ICON });
	}
}

export const notifier: Notifier = new WebNotifier();
