import { useState } from 'react';
import { useT, tError } from '../i18n';
import { useStores } from '../app/store-context';
import type { CustomerDetail, FieldFile } from '../core';
import { Modal, Field, Button, CustomFieldInput } from '../ui';
import { editableGroups, buildProfilePatch } from '../app/customers';

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

// Edit a customer's profile: name, email, and (for a registered account) username, password and
// user groups, plus any custom user fields. Guests only get name + email.
export function CustomerEditModal({ customer, onClose, onSaved }: {
	customer: CustomerDetail;
	onClose: () => void;
	onSaved: (updated: CustomerDetail) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const registered = customer.type !== 'guest' && customer.cms_id > 0;

	const [name, setName] = useState(customer.name);
	const [email, setEmail] = useState(customer.email);
	const [username, setUsername] = useState(customer.username);
	const [password, setPassword] = useState('');
	const [groups, setGroups] = useState<Set<number>>(new Set(customer.groups.map((g) => g.id)));
	const [custom, setCustom] = useState<Record<string, string>>(() => {
		const c: Record<string, string> = {};
		for (const [k, v] of Object.entries(customer.custom_fields ?? {})) c[k] = v ?? '';
		return c;
	});
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	const canEdit = customer.can_edit_account;

	function toggleGroup(id: number) {
		setGroups((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
	}

	async function save() {
		if (!client || busy) return;
		setErr('');
		setBusy(true);
		try {
			const patch = buildProfilePatch(customer, { name, email, username, password, groups, custom });
			onSaved(await client.updateCustomer(customer.id, patch));
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	return (
		<Modal title={t('customers.editProfile')} onClose={onClose}>
			<div className="hk-form">
				<Field label={t('customers.name')}>
					<input className="hk-input" value={name} onChange={(e) => setName(e.target.value)} />
				</Field>
				<Field label={t('customers.email')}>
					<input className="hk-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="off" autoCorrect="off" />
				</Field>

				{registered && canEdit && (
					<>
						<Field label={t('customers.username')}>
							<input className="hk-input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="off" autoCorrect="off" />
						</Field>
						<Field label={t('customers.newPassword')} hint={t('customers.passwordHint')}>
							<input className="hk-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
						</Field>
						{customer.groups_editable ? (
						<Field label={t('customers.groups')}>
							<div className="hk-checkbox-list">
								{editableGroups(customer.available_groups, groups).map((g) => (
									<label key={g.id} className="hk-checkbox-row">
										<input type="checkbox" checked={groups.has(g.id)} disabled={!g.assignable} onChange={() => toggleGroup(g.id)} />
										<span>{g.title}</span>
									</label>
								))}
							</div>
						</Field>
						) : null}
					</>
				)}
				{registered && !canEdit && <div className="hk-muted">{t('customers.cannotEditAccount')}</div>}

				{customer.fields.map((f) => (
					<CustomFieldInput
						key={f.namekey}
						field={f}
						value={custom[f.namekey] ?? ''}
						files={(customer.custom_field_files?.[f.namekey] ?? []) as FieldFile[]}
						readOnlyLabel={t('product.fieldReadOnly')}
						onChange={(v) => setCustom((c) => ({ ...c, [f.namekey]: v }))}
					/>
				))}

				{err && <div className="hk-error-note">{err}</div>}
				<Button variant="pri" block disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</Button>
			</div>
		</Modal>
	);
}
