import { useState } from 'react';
import { useT, tError } from '../i18n';
import { useStores } from '../app/store-context';
import type { CustomerDetail } from '../core';
import { Modal, Field, Button } from '../ui';

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

// Give a guest a real Joomla account: a username and password (the email is already on file).
// On success the customer becomes registered, keeping their existing orders.
export function CustomerAccountModal({ customer, onClose, onSaved }: {
	customer: CustomerDetail;
	onClose: () => void;
	onSaved: (updated: CustomerDetail) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [username, setUsername] = useState(customer.email);
	const [password, setPassword] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	async function save() {
		if (!client || busy) return;
		if (!username.trim() || !password) { setErr(t('customers.missingCredentials')); return; }
		setErr('');
		setBusy(true);
		try {
			onSaved(await client.createCustomerAccount(customer.id, { username: username.trim(), password }));
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	return (
		<Modal title={t('customers.createAccount')} onClose={onClose}>
			<div className="hk-form">
				<p className="hk-muted">{t('customers.createAccountIntro', { email: customer.email })}</p>
				<Field label={t('customers.username')}>
					<input className="hk-input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="off" autoCorrect="off" />
				</Field>
				<Field label={t('customers.password')}>
					<input className="hk-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
				</Field>
				{err && <div className="hk-error-note">{err}</div>}
				<Button variant="pri" block disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('customers.createAccount')}</Button>
			</div>
		</Modal>
	);
}
