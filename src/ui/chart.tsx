import { useId } from 'react';
import type { ReactNode } from 'react';

// Charts drawn as inline SVG rather than with a charting library: two shapes are all the
// dashboard needs, the app has to work offline, and a library would be a large dependency to
// carry for them. Everything is sized in viewBox units and scaled by CSS, so one drawing suits a
// phone and a desktop pane.

export interface Point {
	label: string;   // the x value, already formatted
	value: number;
}

const W = 600;   // viewBox width; the real width comes from CSS
const H = 180;
const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

// Revenue over time. An area under a line, because the shape of the trend is the point and the
// exact daily figure is not: the numbers themselves are in the cards above.
export function AreaChart({ points, format, emptyLabel }: {
	points: Point[];
	// How to render a value in the tooltip/last-point label (money, usually).
	format: (v: number) => ReactNode;
	emptyLabel: string;
}) {
	const gradientId = useId();

	if (points.length === 0) return <div className="hk-empty">{emptyLabel}</div>;

	const max = Math.max(...points.map((p) => p.value), 0);
	const innerW = W - PAD_X * 2;
	const innerH = H - PAD_TOP - PAD_BOTTOM;

	// A single point has no line to draw, so give it a flat one across the width.
	const x = (i: number) => (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1)) + PAD_X;
	const y = (v: number) => PAD_TOP + innerH - (max > 0 ? (v / max) * innerH : 0);

	const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
	const area = `${line} L ${x(points.length - 1).toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(PAD_TOP + innerH).toFixed(1)} Z`;

	const last = points[points.length - 1];

	return (
		<div className="hk-chart">
			<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${points.length} points`}>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" className="hk-chart-fill-top" />
						<stop offset="100%" className="hk-chart-fill-bottom" />
					</linearGradient>
				</defs>
				{/* A baseline, so a flat series still reads as a chart rather than a stray line. */}
				<line x1={PAD_X} y1={PAD_TOP + innerH} x2={W - PAD_X} y2={PAD_TOP + innerH} className="hk-chart-axis" />
				<path d={area} fill={`url(#${gradientId})`} />
				<path d={line} className="hk-chart-line" fill="none" />
				{/* The most recent point is the one being asked about most of the time. */}
				<circle cx={x(points.length - 1)} cy={y(last.value)} r="4" className="hk-chart-dot" />
			</svg>
			<div className="hk-chart-x">
				<span>{points[0].label}</span>
				{points.length > 1 && <span>{last.label}</span>}
			</div>
			<div className="hk-chart-peak">
				<span className="hk-muted">{'↑'}</span> {format(max)}
			</div>
		</div>
	);
}

// A ranked list where the bar carries the comparison and the number carries the detail. Chosen
// over a pie: five names down the side of a phone read far better than five wedges.
export function BarList({ items, emptyLabel }: {
	items: { label: string; value: number; display?: ReactNode }[];
	emptyLabel: string;
}) {
	if (items.length === 0) return <div className="hk-empty">{emptyLabel}</div>;
	const max = Math.max(...items.map((i) => i.value), 1);

	return (
		<div className="hk-barlist">
			{items.map((item, i) => (
				<div key={i} className="hk-bar-row">
					<div className="hk-bar-head">
						<span className="hk-bar-label">{item.label}</span>
						<span className="hk-bar-value">{item.display ?? item.value}</span>
					</div>
					<div className="hk-bar-track">
						<div className="hk-bar-fill" style={{ width: `${Math.max(2, (item.value / max) * 100)}%` }} />
					</div>
				</div>
			))}
		</div>
	);
}
