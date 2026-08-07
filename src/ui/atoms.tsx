import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { useT } from '../i18n';
import { useStatuses } from '../app/statuses';
import { Icon } from './icons';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: 'default' | 'pri' | 'ghost' | 'danger';
	size?: 'default' | 'sm';
	block?: boolean;
};

export function Button({ variant = 'default', size = 'default', block, className = '', children, ...rest }: ButtonProps) {
	const cls = [
		'hk-btn',
		variant !== 'default' ? `hk-btn--${variant}` : '',
		size === 'sm' ? 'hk-btn--sm' : '',
		block ? 'hk-btn--block' : '',
		className,
	].filter(Boolean).join(' ');
	return (
		<button className={cls} {...rest}>
			{children}
		</button>
	);
}

// The uniform "+ New" action used in every list screen's header (Screen `right` slot).
export function NewButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label?: string }) {
	const t = useT();
	return (
		<Button variant="pri" size="sm" disabled={disabled} onClick={onClick}>
			<Icon name="plus" size={16} /> {label ?? t('common.new')}
		</Button>
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
	const { statusLabel, statusColor } = useStatuses();
	const norm = (status || '').toLowerCase();
	const kind = STATUS_KIND[norm] ?? 'neutral';
	const label = statusLabel(status);
	// A merchant-set status color, when present, overrides the semantic kind color.
	const color = statusColor(status);
	const style: CSSProperties | undefined = color ? { background: color, color: '#fff', borderColor: color } : undefined;
	return <span className={`hk-status hk-status--${kind}`} style={style}>{label}</span>;
}

