import { useMemo, useState } from 'react';
import { Icon } from './icons';

const iso = (y: number, m0: number, d: number) => `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// A dependency-free month calendar. Monday-first grid, navigable; each day is disabled
// via isDisabled(iso). Selected endpoints and in-range days are highlighted. Emits the
// clicked day as yyyy-mm-dd.
export function DateCalendar({ isDisabled, selected, inRange, onPick, openOn }: {
	isDisabled: (iso: string) => boolean;
	selected: string[];
	inRange?: (iso: string) => boolean;
	onPick: (iso: string) => void;
	openOn?: string;
}) {
	const start = openOn || selected[0] || new Date().toISOString().slice(0, 10);
	const [view, setView] = useState(() => { const [y, m] = start.split('-').map(Number); return { y, m0: (m || 1) - 1 }; });

	const weeks = useMemo(() => buildWeeks(view.y, view.m0), [view]);
	const monthLabel = new Date(Date.UTC(view.y, view.m0, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
	const dow = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

	function shift(delta: number) {
		setView((v) => { const m = v.m0 + delta; return { y: v.y + Math.floor(m / 12), m0: ((m % 12) + 12) % 12 }; });
	}

	return (
		<div className="hk-cal">
			<div className="hk-cal-head">
				<button type="button" className="hk-iconbtn" onClick={() => shift(-1)} aria-label="previous month"><Icon name="chevron" size={16} className="hk-rot180" /></button>
				<span className="hk-cal-title">{monthLabel}</span>
				<button type="button" className="hk-iconbtn" onClick={() => shift(1)} aria-label="next month"><Icon name="chevron" size={16} /></button>
			</div>
			<div className="hk-cal-grid">
				{dow.map((d) => <span key={d} className="hk-cal-dow">{d}</span>)}
				{weeks.map((cell, i) => {
					if (cell === null) return <span key={i} />;
					const s = iso(view.y, view.m0, cell);
					const disabled = isDisabled(s);
					const isSel = selected.includes(s);
					const mid = !isSel && inRange?.(s);
					return (
						<button key={i} type="button" disabled={disabled}
							className={`hk-cal-day${isSel ? ' hk-on' : ''}${mid ? ' hk-mid' : ''}`}
							onClick={() => onPick(s)}>{cell}</button>
					);
				})}
			</div>
		</div>
	);
}

// A flat list of the month's cells (null for leading blanks), Monday-first.
function buildWeeks(year: number, m0: number): (number | null)[] {
	const firstWeekday = new Date(Date.UTC(year, m0, 1)).getUTCDay(); // 0 = Sunday
	const lead = (firstWeekday + 6) % 7; // Monday-first offset
	const days = new Date(Date.UTC(year, m0 + 1, 0)).getUTCDate();
	const cells: (number | null)[] = [];
	for (let i = 0; i < lead; i++) cells.push(null);
	for (let d = 1; d <= days; d++) cells.push(d);
	return cells;
}
