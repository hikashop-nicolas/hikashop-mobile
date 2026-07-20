import { describe, it, expect } from 'vitest';
import { isDateDisabled, nightsBetween, isoRangeToHika, hikaToIsoRange } from './datepicker';
import type { DatepickerConfig } from './models';

const base: DatepickerConfig = {
	allow: '', waiting: 0, days_from_now: 0, forbidden_days: [],
	range: false, range_exclude_end: true, range_min_nights: 1, range_max_nights: 0,
	exclude_days: [], exclude_dates: [], exclude_ranges: [], exclude_patterns: [],
};

describe('isDateDisabled', () => {
	it('is never disabled without a config', () => {
		expect(isDateDisabled('2026-08-15')).toBe(false);
	});

	it('disables forbidden weekdays (0=Sun..6=Sat)', () => {
		const cfg = { ...base, forbidden_days: [0, 6] }; // Sun + Sat
		expect(isDateDisabled('2026-08-15', cfg)).toBe(true);  // Saturday
		expect(isDateDisabled('2026-08-16', cfg)).toBe(true);  // Sunday
		expect(isDateDisabled('2026-08-19', cfg)).toBe(false); // Wednesday
	});

	it('disables a recurring month+day (any year)', () => {
		const cfg = { ...base, exclude_days: [1225] }; // Dec 25
		expect(isDateDisabled('2026-12-25', cfg)).toBe(true);
		expect(isDateDisabled('2030-12-25', cfg)).toBe(true);
		expect(isDateDisabled('2026-12-24', cfg)).toBe(false);
	});

	it('disables a specific exact date', () => {
		const cfg = { ...base, exclude_dates: [20260405] };
		expect(isDateDisabled('2026-04-05', cfg)).toBe(true);
		expect(isDateDisabled('2027-04-05', cfg)).toBe(false);
	});

	it('disables a month-day range (count 2) and a full-date range (count 3)', () => {
		expect(isDateDisabled('2026-02-14', { ...base, exclude_ranges: [[201, 214, 2]] })).toBe(true);
		expect(isDateDisabled('2026-03-01', { ...base, exclude_ranges: [[201, 214, 2]] })).toBe(false);
		expect(isDateDisabled('2026-06-10', { ...base, exclude_ranges: [[20260601, 20260615, 3]] })).toBe(true);
		expect(isDateDisabled('2027-06-10', { ...base, exclude_ranges: [[20260601, 20260615, 3]] })).toBe(false);
	});

	it('disables wildcard patterns (0 = any)', () => {
		expect(isDateDisabled('2026-02-09', { ...base, exclude_patterns: [[2, 0, 0]] })).toBe(true); // all February
		expect(isDateDisabled('2026-03-09', { ...base, exclude_patterns: [[2, 0, 0]] })).toBe(false);
		expect(isDateDisabled('2030-04-05', { ...base, exclude_patterns: [[4, 5, 0]] })).toBe(true); // April 5th, any year
	});
});

describe('range helpers', () => {
	it('counts nights and round-trips the hika range string', () => {
		expect(nightsBetween('2026-08-15', '2026-08-18')).toBe(3);
		expect(isoRangeToHika('2026-08-15', '2026-08-18')).toBe('20260815000000-20260818000000');
		expect(hikaToIsoRange('20260815000000-20260818000000')).toEqual({ start: '2026-08-15', end: '2026-08-18' });
		expect(hikaToIsoRange('')).toEqual({ start: '', end: '' });
	});
});
