// HikaShop stores dates as unix seconds; the app's date inputs use yyyy-mm-dd.
export function tsToDate(ts: number): string {
	return ts > 0 ? new Date(ts * 1000).toISOString().slice(0, 10) : '';
}

export function dateToTs(s: string): number {
	return s ? Math.floor(new Date(`${s}T00:00:00Z`).getTime() / 1000) : 0;
}
