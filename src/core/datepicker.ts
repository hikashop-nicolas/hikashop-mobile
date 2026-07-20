import type { DatepickerConfig } from './models';
import { isoFromToday } from './dates';

// Whether a date (yyyy-mm-dd) is disabled by a datepicker field's config. Ports the
// storefront's hikashopDatepicker_excludeWDays checks (weekday / month-day / exact
// date / range / wildcard pattern) plus the allow-past/future min-max bounds so the
// app greys out exactly the days HikaShop's jQuery UI widget would.
export function isDateDisabled(iso: string, cfg?: DatepickerConfig): boolean {
	if (!iso) return false;
	const [y, m, d] = iso.split('-').map(Number);
	if (!y || !m || !d) return true;

	const bounds = dateBounds(cfg);
	if (bounds.min && iso < bounds.min) return true;
	if (bounds.max && iso > bounds.max) return true;
	if (!cfg) return false;

	const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
	if (cfg.forbidden_days.includes(weekday)) return true;

	const md = m * 100 + d;
	const fd = y * 10000 + md;
	if (cfg.exclude_days.includes(md)) return true;
	if (cfg.exclude_dates.includes(fd)) return true;
	for (const [start, end, count] of cfg.exclude_ranges) {
		if (count === 2) { if (md >= start && md <= end) return true; }
		else if (fd >= start && fd <= end) return true;
	}
	for (const [pm, pd, py] of cfg.exclude_patterns) {
		if ((pm === 0 || pm === m) && (pd === 0 || pd === d) && (py === 0 || py === y)) return true;
	}
	return false;
}

// The allowed [min, max] yyyy-mm-dd window from allow + waiting + days_from_now.
export function dateBounds(cfg?: DatepickerConfig): { min: string; max: string } {
	if (!cfg) return { min: '', max: '' };
	const wait = cfg.waiting || 0;
	const span = cfg.days_from_now || 0;
	if (cfg.allow === 'future') return { min: isoFromToday(wait), max: span > 0 ? isoFromToday(span) : '' };
	if (cfg.allow === 'past') return { min: span > 0 ? isoFromToday(-span) : '', max: isoFromToday(-wait) };
	return { min: '', max: '' };
}

// Nights between two yyyy-mm-dd dates.
export function nightsBetween(startIso: string, endIso: string): number {
	if (!startIso || !endIso) return 0;
	const a = Date.parse(`${startIso}T00:00:00Z`);
	const b = Date.parse(`${endIso}T00:00:00Z`);
	return Math.round((b - a) / 86400000);
}

// HikaShop stores a date range as YYYYMMDD000000-YYYYMMDD000000.
export function isoRangeToHika(startIso: string, endIso: string): string {
	const c = (s: string) => s.replace(/-/g, '') + '000000';
	return startIso && endIso ? `${c(startIso)}-${c(endIso)}` : '';
}

export function hikaToIsoRange(v: string): { start: string; end: string } {
	const m = /^(\d{4})(\d{2})(\d{2})\d{6}-(\d{4})(\d{2})(\d{2})\d{6}$/.exec((v || '').trim());
	return m ? { start: `${m[1]}-${m[2]}-${m[3]}`, end: `${m[4]}-${m[5]}-${m[6]}` } : { start: '', end: '' };
}
