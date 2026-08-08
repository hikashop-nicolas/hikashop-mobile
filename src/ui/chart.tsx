import { useId } from 'react';
import type { ReactNode } from 'react';

// Charts drawn as inline SVG rather than with a charting library: the dashboard needs two shapes,
// the app has to work offline, and a library would be a large dependency to carry for them.
//
// The drawing uses a fixed viewBox and is stretched to whatever width it is given, so one
// drawing suits a phone and a desktop pane. Stretching would normally distort the strokes, so
// every stroked shape sets vector-effect: non-scaling-stroke, and nothing round is drawn -- a
// circle in a stretched viewBox becomes an ellipse. Text lives in HTML around the chart rather
// than inside it, for the same reason.

export interface Point {
	label: string;   // the x value, already formatted
	value: number;
}

const W = 600;
const H = 160;
const PAD_X = 6;
const PAD_TOP = 10;
const PAD_BOTTOM = 6;

// Revenue over time: an area under a line. The shape of the trend is the point; the figures
// themselves are in the cards above, so the chart carries no gridlines or value axis.
export function AreaChart({ points, peak, emptyLabel }: {
	points: Point[];
	// The highest value, already formatted, labelled on the chart so the scale is readable.
	peak?: ReactNode;
	emptyLabel: string;
}) {
	const gradientId = useId();

	if (points.length === 0) return <div className="hk-empty">{emptyLabel}</div>;

	const max = Math.max(...points.map((p) => p.value), 0);
	const innerW = W - PAD_X * 2;
	const innerH = H - PAD_TOP - PAD_BOTTOM;
	const baseY = PAD_TOP + innerH;

	// One point has no line to draw, so it sits in the middle and the area is a flat block.
	const x = (i: number) => (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1)) + PAD_X;
	const y = (v: number) => baseY - (max > 0 ? (v / max) * innerH : 0);

	const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
	const area = `${line} L ${x(points.length - 1).toFixed(1)} ${baseY} L ${x(0).toFixed(1)} ${baseY} Z`;
	const lastX = x(points.length - 1);

	return (
		<div className="hk-chart">
			{peak !== undefined && (
				<div className="hk-chart-peak">{peak}</div>
			)}
			<svg
				className="hk-chart-svg"
				viewBox={`0 0 ${W} ${H}`}
				preserveAspectRatio="none"
				role="img"
				aria-label={`${points[0].label} to ${points[points.length - 1].label}`}
			>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" className="hk-chart-stop-top" />
						<stop offset="100%" className="hk-chart-stop-bottom" />
					</linearGradient>
				</defs>
				<path d={area} fill={`url(#${gradientId})`} />
				<path d={line} className="hk-chart-line" fill="none" vectorEffect="non-scaling-stroke" />
				{/* The latest point, marked with a rule rather than a dot: a dot would be an ellipse. */}
				<line x1={lastX} y1={y(points[points.length - 1].value)} x2={lastX} y2={baseY}
					className="hk-chart-marker" vectorEffect="non-scaling-stroke" />
				<line x1={PAD_X} y1={baseY} x2={W - PAD_X} y2={baseY}
					className="hk-chart-axis" vectorEffect="non-scaling-stroke" />
			</svg>
			<div className="hk-chart-x">
				<span>{points[0].label}</span>
				{points.length > 1 && <span>{points[points.length - 1].label}</span>}
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
						{/* A minimum width so the smallest bar is still visibly a bar. */}
						<div className="hk-bar-fill" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} />
					</div>
				</div>
			))}
		</div>
	);
}
