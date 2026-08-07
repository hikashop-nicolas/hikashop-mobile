import { useState } from 'react';
import { useT, tError } from '../i18n';
import { useStores } from '../app/store-context';
import { Modal, Field, Button } from '../ui';

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

// Create a new customer from a name + email. This makes a guest customer; a login can be added
// later from the customer's detail ("Create account").
export function NewCustomerModal({ onClose, onCreated }: {
	onClose: () => void;
	onCreated: (id: number) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	async function save() {
		if (!client || busy) return;
		if (!email.trim()) { setErr(t('customers.emailRequired')); return; }
		setErr('');
		setBusy(true);
		try {
			const { id } = await client.createCustomer({ email: email.trim(), name: name.trim() || undefined });
			onCreated(id);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	return (
		<Modal title={t('customers.newCustomer')} onClose={onClose}>
			<div className="hk-form">
				<Field label={t('customers.name')}>
					<input className="hk-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
				</Field>
				<Field label={t('customers.email')}>
					<input className="hk-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="off" autoCorrect="off" inputMode="email" />
				</Field>
				{err && <div className="hk-error-note">{err}</div>}
				<Button variant="pri" block disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.create')}</Button>
			</div>
		</Modal>
	);
}
