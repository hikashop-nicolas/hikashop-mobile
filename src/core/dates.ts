// HikaShop stores dates as unix seconds; the app's date inputs use yyyy-mm-dd.
export function tsToDate(ts: number): string {
	return ts > 0 ? new Date(ts * 1000).toISOString().slice(0, 10) : '';
}

export function dateToTs(s: string): number {
	return s ? Math.floor(new Date(`${s}T00:00:00Z`).getTime() / 1000) : 0;
}

// HikaShop's advanced date picker stores the value in altFormat "yy/mm/dd"
// (e.g. 2026/08/15). Convert to/from the ISO yyyy-mm-dd that a native date input uses.
export function hikaDateToIso(v: string): string {
	const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec((v || '').trim());
	return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

export function isoToHikaDate(iso: string): string {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
	return m ? `${m[1]}/${m[2]}/${m[3]}` : '';
}

// A yyyy-mm-dd string shifted by a number of days from today (UTC), for min/max bounds.
export function isoFromToday(days: number): string {
	const now = new Date();
	const utc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + days * 86400000;
	return new Date(utc).toISOString().slice(0, 10);
}
