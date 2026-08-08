export function normalizeUrl(input: string): string {
	let s = input.trim();
	if (!s) return s;
	if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
	return s.replace(/\/+$/, '');
}

// How a store is named and identified in the app. The host alone is not enough: two shops can
// live in folders of one domain (a staging copy beside the live one is the common case), and
// naming them both "example.com" makes the store list and the app bar useless for telling them
// apart. The path comes along whenever there is one.
export function hostOf(url: string): string {
	try {
		const u = new URL(url);
		const path = u.pathname.replace(/\/+$/, '');
		return u.host + path;
	} catch {
		return url;
	}
}

export function deviceName(): string {
	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	if (/android/i.test(ua)) return 'Android device';
	if (/iphone|ipad|ipod/i.test(ua)) return 'iOS device';
	return 'Web browser';
}

export function fmtDate(ts: number, locale?: string): string {
	if (!ts) return '-';
	return new Date(ts * 1000).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
