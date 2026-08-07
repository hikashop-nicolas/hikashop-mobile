import { useEffect, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { UserItem } from '../core';
import { Modal, Search, Field, Button, Spinner } from '../ui';

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

// Create a new order: attach it to an existing customer (search) or a guest (name + email).
export function NewOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: (orderId: number) => void }) {
	const { client } = useStores();
	const t = useT();
	const [mode, setMode] = useState<'existing' | 'guest'>('existing');
	const [query, setQuery] = useState('');
	const [results, setResults] = useState<UserItem[]>([]);
	const [searching, setSearching] = useState(false);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	useEffect(() => {
		if (mode !== 'existing' || query.trim().length < 2) { setResults([]); return; }
		let alive = true;
		setSearching(true);
		const id = setTimeout(() => {
			void (async () => {
				try { const r = await client!.getUsers({ search: query.trim() }); if (alive) setResults(r); }
				catch (e) { if (alive) setErr(tError(t, codeOf(e))); }
				finally { if (alive) setSearching(false); }
			})();
		}, 300);
		return () => { alive = false; clearTimeout(id); };
	}, [query, mode, client, t]);

	async function create(customer: { user_id: number } | { guest: { name?: string; email: string } }) {
		if (busy) return;
		setErr('');
		setBusy(true);
		try {
			const res = await client!.createOrder(customer);
			onCreated(res.id);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	return (
		<Modal title={t('orders.newOrder')} onClose={onClose}>
			<div style={{ display: 'flex', gap: 'var(--hk-s2)', marginBottom: 'var(--hk-s3)' }}>
				<button className={`hk-chip${mode === 'existing' ? ' hk-on' : ''}`} onClick={() => setMode('existing')}>{t('orders.existingCustomer')}</button>
				<button className={`hk-chip${mode === 'guest' ? ' hk-on' : ''}`} onClick={() => setMode('guest')}>{t('orders.guestCustomer')}</button>
			</div>

			{mode === 'existing' ? (
				<>
					<Search value={query} onChange={setQuery} placeholder={t('product.searchUsers')} />
					{busy ? (
						<div className="hk-center-col"><Spinner /></div>
					) : searching ? (
						<div className="hk-center-col"><Spinner /></div>
					) : query.trim().length < 2 ? (
						<div className="hk-empty">{t('picker.typeToSearch')}</div>
					) : results.length === 0 ? (
						<div className="hk-empty">{t('picker.noResults')}</div>
					) : (
						<div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
							{results.map((u) => (
								<button key={u.id} type="button" className="hk-row hk-row-btn" disabled={busy} onClick={() => void create({ user_id: u.id })}>
									<div className="hk-row-grow"><span className="hk-row-title">{u.name || u.email}</span>{u.name && <span className="hk-row-sub">{u.email}</span>}</div>
								</button>
							))}
						</div>
					)}
				</>
			) : (
				<div className="hk-form">
					<Field label={t('order.customerName')}>
						<input className="hk-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />
					</Field>
					<Field label={t('order.customerEmail')}>
						<input className="hk-input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
					</Field>
					<Button variant="pri" block disabled={busy || !email.trim()} onClick={() => void create({ guest: { name: name.trim(), email: email.trim() } })}>
						{busy ? t('product.saving') : t('orders.createOrder')}
					</Button>
				</div>
			)}
			{err && <div className="hk-error-note" style={{ marginTop: 'var(--hk-s3)' }}>{err}</div>}
		</Modal>
	);
}
