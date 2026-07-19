import type { ButtonHTMLAttributes } from 'react';
import { useT } from '../i18n';

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
	const t = useT();
	return <div className="hk-spinner" role="status" aria-label={t('loading')} />;
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
	const t = useT();
	const norm = (status || '').toLowerCase();
	const kind = STATUS_KIND[norm] ?? 'neutral';
	// Use a translated status label when we have one; otherwise fall back to the raw value.
	const key = `status.${norm}`;
	const translated = t(key);
	const label = translated !== key ? translated : (status ? status.charAt(0).toUpperCase() + status.slice(1) : '');
	return <span className={`hk-status hk-status--${kind}`}>{label}</span>;
}

export function Money({ value }: { value: number }) {
	return <span className="hk-money">{Number(value ?? 0).toFixed(2)}</span>;
}
