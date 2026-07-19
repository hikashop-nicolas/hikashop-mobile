export function normalizeUrl(input: string): string {
	let s = input.trim();
	if (!s) return s;
	if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
	return s.replace(/\/+$/, '');
}

export function hostOf(url: string): string {
	try {
		return new URL(url).host;
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

export function fmtDate(ts: number): string {
	if (!ts) return '-';
	return new Date(ts * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
