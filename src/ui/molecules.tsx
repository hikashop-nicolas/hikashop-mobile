import { Children, cloneElement, isValidElement, useId } from 'react';
import type { ReactNode, ReactElement } from 'react';
import { Icon } from './icons';

// Which children a label can be attached to. A field that holds something else (a picker
// button, a row of controls, a chip list) is left alone: labelling the wrong control, or
// wrapping the whole field in a label so that clicking anywhere presses its button, would both
// be worse than the plain text this used to render.
const NATIVE_CONTROLS = ['input', 'select', 'textarea'];

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
	const id = useId();
	const only = Children.count(children) === 1 ? Children.only(children) : null;
	const control = isValidElement(only) && typeof only.type === 'string' && NATIVE_CONTROLS.includes(only.type)
		? (only as ReactElement<{ id?: string }>)
		: null;

	// The label used to be a span, so a screen reader announced every field in the app as an
	// unnamed text box. It is a real label now, tied to its control by id.
	const body = control && !control.props.id ? cloneElement(control, { id }) : children;

	return (
		<div className="hk-field">
			{label && (control ? <label className="hk-label" htmlFor={id}>{label}</label> : <span className="hk-label">{label}</span>)}
			{body}
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
			{/* A placeholder is not a name: it disappears as soon as there is a value, and some
			    screen readers ignore it. The placeholder text doubles as the label. */}
			<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} data-hk-search />
		</div>
	);
}
