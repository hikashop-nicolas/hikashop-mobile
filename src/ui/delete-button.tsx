import { useState } from 'react';
import { Button } from './atoms';
import { Modal } from './layout';
import { Icon } from './icons';
import { useT } from '../i18n';

// The one destructive action in the app. Two affordances, one behaviour:
//   mode="labeled" — a danger button with a label, used for deleting an entity from its edit form.
//   mode="icon"    — a bin icon, used for removing a sub-item from a row (address, price, variant…).
// Passing confirmMessage adds a confirmation step (a modal, never window.confirm, which is
// unusable on mobile and blocks the webview). Omit it for removals that are not yet persisted.
export function DeleteButton({ mode = 'labeled', label, confirmMessage, confirmTitle, disabled, block, size = 'default', onConfirm }: {
	mode?: 'labeled' | 'icon';
	label: string; // visible text in labeled mode; the accessible name in icon mode
	confirmMessage?: string;
	confirmTitle?: string;
	disabled?: boolean;
	block?: boolean;
	size?: 'default' | 'sm';
	onConfirm: () => void | Promise<void>;
}) {
	const t = useT();
	const [asking, setAsking] = useState(false);

	function trigger() {
		if (confirmMessage) setAsking(true);
		else void onConfirm();
	}

	async function confirm() {
		setAsking(false);
		await onConfirm();
	}

	return (
		<>
			{mode === 'icon' ? (
				<button type="button" className="hk-iconbtn hk-danger" disabled={disabled} aria-label={label} onClick={trigger}>
					<Icon name="trash" size={18} />
				</button>
			) : (
				<Button variant="danger" size={size} block={block} disabled={disabled} onClick={trigger}>
					<Icon name="trash" size={size === 'sm' ? 15 : 16} /> {label}
				</Button>
			)}
			{asking && (
				<Modal title={confirmTitle ?? label} onClose={() => setAsking(false)}>
					<div className="hk-form">
						<p className="hk-row-sub">{confirmMessage}</p>
						<div style={{ display: 'flex', gap: 'var(--hk-s2)', justifyContent: 'flex-end' }}>
							<Button onClick={() => setAsking(false)}>{t('common.cancel')}</Button>
							<Button variant="danger" onClick={() => void confirm()}>{t('common.delete')}</Button>
						</div>
					</div>
				</Modal>
			)}
		</>
	);
}
