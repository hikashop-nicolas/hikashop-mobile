import type { ButtonHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'default' | 'pri' | 'ghost' | 'danger';
	block?: boolean;
};

export function Button({ variant = 'default', block, className = '', children, ...rest }: ButtonProps) {
	const cls = [
		'hk-btn',
		variant !== 'default' ? `hk-btn--${variant}` : '',
		block ? 'hk-btn--block' : '',
		className,
	].filter(Boolean).join(' ');
	return (
		<button className={cls} {...rest}>
			{children}
		</button>
	);
}

export function Spinner() {
	return <div className="hk-spinner" role="status" aria-label="Loading" />;
}

const STATUS_KIND: Record<string, 'ok' | 'warn' | 'crit' | 'neutral'> = {
	confirmed: 'ok',
	shipped: 'ok',
	completed: 'ok',
	processing: 'warn',
	pending: 'neutral',
	created: 'neutral',
	cancelled: 'crit',
	refunded: 'crit',
};

export function StatusChip({ status }: { status: string }) {
	const kind = STATUS_KIND[(status || '').toLowerCase()] ?? 'neutral';
	const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
	return <span className={`hk-status hk-status--${kind}`}>{label}</span>;
}

export function Money({ value }: { value: number }) {
	return <span className="hk-money">{Number(value ?? 0).toFixed(2)}</span>;
}
