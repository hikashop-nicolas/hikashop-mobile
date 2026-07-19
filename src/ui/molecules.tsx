import type { ReactNode } from 'react';

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
	return (
		<div className="hk-field">
			{label && <span className="hk-label">{label}</span>}
			{children}
			{error ? <span className="hk-err">{error}</span> : hint ? <span className="hk-hint">{hint}</span> : null}
		</div>
	);
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
	return (
		<div className="hk-stat">
			<span className="hk-stat-k">{label}</span>
			<span className="hk-stat-n">{value}</span>
		</div>
	);
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
	return (
		<div className="hk-search">
			<span aria-hidden>⌕</span>
			<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
		</div>
	);
}
