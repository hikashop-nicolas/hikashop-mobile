import type { ReactNode } from 'react';
import { Icon } from './icons';

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
	return (
		<div className="hk-field">
			{label && <span className="hk-label">{label}</span>}
			{children}
			{error ? <span className="hk-err">{error}</span> : hint ? <span className="hk-hint">{hint}</span> : null}
		</div>
	);
}

// How this figure compares with the one before it. Returns null when there is nothing worth
// saying: no movement to speak of, or no earlier figure to move from.
function deltaOf(current: number, previous: number): { dir: 'up' | 'down'; percent: number | null } | null {
	if (previous === 0) return current > 0 ? { dir: 'up', percent: null } : null;
	const percent = Math.round(((current - previous) / previous) * 100);
	if (percent === 0) return null;
	return { dir: percent > 0 ? 'up' : 'down', percent };
}

export function StatCard({ label, value, compare, newLabel }: {
	label: string;
	value: ReactNode;
	// The same figure for this period and the one before, to show which way it moved.
	compare?: { current: number; previous: number };
	// Shown instead of a percentage when there is no earlier figure to compare against.
	newLabel?: string;
}) {
	const delta = compare ? deltaOf(compare.current, compare.previous) : null;
	return (
		<div className="hk-stat">
			<span className="hk-stat-k">{label}</span>
			<span className="hk-stat-n">{value}</span>
			{delta && (
				// The sign is in the text as well as the colour, so the direction does not depend
				// on being able to tell green from red.
				<span className={`hk-delta hk-delta--${delta.dir}`}>
					<Icon name={delta.dir === 'up' ? 'trendUp' : 'trendDown'} size={13} />
					{delta.percent === null ? (newLabel ?? '') : `${delta.percent > 0 ? '+' : ''}${delta.percent}%`}
				</span>
			)}
		</div>
	);
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
	return (
		<div className="hk-search">
			<span className="hk-search-ic"><Icon name="search" size={18} /></span>
			<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
		</div>
	);
}
