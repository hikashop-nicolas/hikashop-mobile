import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useI18n, tError } from '../i18n';
import type { CustomerDetail as CustomerDetailType, CustomerAddress } from '../core';
import { Screen, StatusChip, Money, Spinner, Icon, Button, DeleteButton } from '../ui';
import { fmtDate } from '../app/utils';
import { CustomerEditModal } from './CustomerEditModal';
import { CustomerAccountModal } from './CustomerAccountModal';
import { CustomerAddressModal } from './CustomerAddressModal';
import { addressesOfType, defaultAddressId, canSetDefault as offerSetDefault } from '../app/customers';
import { addressOneLine } from './address-format';

export function CustomerDetail() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
	const storeId = active?.id ?? '';
	const customerId = Number(id);

	const { data: fetched, loading, error } = useCached<CustomerDetailType>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getCustomer(storeId, customerId),
		fetch: () => client!.getCustomer(customerId),
		write: async (c) => { await cache.putCustomer(storeId, customerId, c); },
		deps: [storeId, customerId],
	});

	// Local copy so an edit reflects instantly without a full reload.
	const [customer, setCustomer] = useState<CustomerDetailType | null>(null);
	useEffect(() => { if (fetched) setCustomer(fetched); }, [fetched]);

	const [editing, setEditing] = useState(false);
	const [creatingAccount, setCreatingAccount] = useState(false);
	const [editingAddress, setEditingAddress] = useState<null | { addressId: number; types: string[] }>(null);
	const [addrBusy, setAddrBusy] = useState(0);

	async function applyUpdate(updated: CustomerDetailType) {
		setCustomer(updated);
		await cache.putCustomer(storeId, customerId, updated);
	}

	async function removeAddress(addressId: number) {
		if (!client || addrBusy) return;
		setAddrBusy(addressId);
		try {
			await applyUpdate(await client.deleteCustomerAddress(customerId, addressId));
		} finally {
			setAddrBusy(0);
		}
	}

	async function makeDefault(addressId: number) {
		if (!client || addrBusy) return;
		setAddrBusy(addressId);
		try {
			await applyUpdate(await client.setDefaultCustomerAddress(customerId, addressId));
		} finally {
			setAddrBusy(0);
		}
	}

	return (
		<Screen
			title={customer ? (customer.name || customer.email || t('common.guest')) : t('customers.detailTitle')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={customer ? <button className="hk-iconbtn" onClick={() => setEditing(true)} aria-label={t('customers.editProfile')}><Icon name="edit" size={22} /></button> : undefined}
		>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : !customer ? (
				<div className="hk-empty">{t('customers.none')}</div>
			) : (
				<>
					<div className="hk-card hk-card--pad">
						<div className="hk-row-title">
							{customer.name || t('common.guest')}
							<span className={`hk-status ${customer.type === 'guest' ? 'hk-status--neutral' : 'hk-status--ok'}`} style={{ marginLeft: 'var(--hk-s2)' }}>
								{customer.type === 'guest' ? t('customers.guest') : t('customers.registered')}
							</span>
							{customer.blocked && <span className="hk-status hk-status--warn" style={{ marginLeft: 'var(--hk-s2)' }}>{t('customers.blocked')}</span>}
						</div>
						<div className="hk-row-sub">{customer.email}</div>
						{customer.type !== 'guest' && customer.username && <div className="hk-row-sub">{t('customers.username')}: {customer.username}</div>}
						<div className="hk-row-sub">{t('customers.since', { date: fmtDate(customer.created, locale) })}</div>
						{(customer.groups ?? []).length > 0 && (
							<div style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap', marginTop: 'var(--hk-s2)' }}>
								{(customer.groups ?? []).map((g) => <span key={g.id} className="hk-status hk-status--neutral">{g.title}</span>)}
							</div>
						)}
						{customer.type === 'guest' && (
							<div style={{ marginTop: 'var(--hk-s3)' }}>
								<Button variant="pri" size="sm" onClick={() => setCreatingAccount(true)}>{t('customers.createAccount')}</Button>
							</div>
						)}
					</div>

					{/* Custom user fields (read display; editing is in the profile editor). */}
					{customer.fields.length > 0 && (
						<div className="hk-card hk-card--pad">
							<div className="hk-card-head">
								<span className="hk-muted hk-row-grow">{t('customers.details')}</span>
							</div>
							{customer.fields.map((f) => {
								const v = (customer.custom_fields?.[f.namekey] ?? '') || '—';
								return (
									<div key={f.namekey} className="hk-row">
										<div className="hk-row-grow"><span className="hk-row-sub">{f.label}</span></div>
										<span className="hk-row-title" style={{ fontWeight: 400 }}>{String(v)}</span>
									</div>
								);
							})}
						</div>
					)}

					<div className="hk-card hk-card--pad">
						<div className="hk-card-head">
							<span className="hk-muted hk-row-grow">{t('customers.orders')}</span>
						</div>
						{customer.orders.length === 0 ? (
							<div className="hk-row-sub">{t('customers.noOrders')}</div>
						) : customer.orders.map((o) => (
							<Link key={o.id} to={`/orders/${o.id}`} className="hk-row">
								<div className="hk-row-grow">
									<span className="hk-row-title">#{o.number}</span>
									<span className="hk-row-sub">{fmtDate(o.created, locale)}</span>
								</div>
								<div className="hk-row-rt"><StatusChip status={o.status} /><Money value={o.total} currency={o.currency_id} /></div>
							</Link>
						))}
					</div>

					{(['billing', 'shipping'] as const).map((type) => {
						const list = addressesOfType(customer.addresses, type);
						const defaultId = defaultAddressId(list);
						return (
							<div key={type} className="hk-card hk-card--pad">
								<div className="hk-card-head">
									<span className="hk-muted hk-row-grow">{t(type === 'billing' ? 'customers.billing' : 'customers.shipping')}</span>
									<Button variant="pri" size="sm" onClick={() => setEditingAddress({ addressId: 0, types: [type] })}><Icon name="plus" size={15} /> {t('customers.addAddressShort')}</Button>
								</div>
								{list.length === 0 ? (
									<div className="hk-row-sub">{t('customers.noAddresses')}</div>
								) : list.map((a) => (
									<AddressBlock
										key={a.id}
										address={a}
										isDefault={a.id === defaultId}
										canSetDefault={offerSetDefault(list, a.id)}
										defaultLabel={t('customers.defaultAddress')}
										setDefaultLabel={t('customers.setDefault')}
										editLabel={t('product.edit')}
										deleteLabel={t('common.delete')}
										confirmLabel={t('customers.deleteAddressConfirm')}
										busy={addrBusy === a.id}
										onEdit={() => setEditingAddress({ addressId: a.id, types: a.types.length ? a.types : [type] })}
										onDelete={() => void removeAddress(a.id)}
										onSetDefault={() => void makeDefault(a.id)}
									/>
								))}
							</div>
						);
					})}
				</>
			)}

			{editing && customer && (
				<CustomerEditModal customer={customer} onClose={() => setEditing(false)} onSaved={(u) => { setEditing(false); void applyUpdate(u); }} onDeleted={() => nav('/customers')} />
			)}
			{creatingAccount && customer && (
				<CustomerAccountModal customer={customer} onClose={() => setCreatingAccount(false)} onSaved={(u) => { setCreatingAccount(false); void applyUpdate(u); }} />
			)}
			{editingAddress && customer && (
				<CustomerAddressModal
					customerId={customer.id}
					addressId={editingAddress.addressId}
					types={editingAddress.types}
					onClose={() => setEditingAddress(null)}
					onSaved={(u) => { setEditingAddress(null); void applyUpdate(u); }}
				/>
			)}
		</Screen>
	);
}

function AddressBlock({ address, isDefault, canSetDefault, defaultLabel, setDefaultLabel, editLabel, deleteLabel, confirmLabel, busy, onEdit, onDelete, onSetDefault }: {
	address: CustomerAddress;
	isDefault: boolean;
	canSetDefault: boolean;
	defaultLabel: string;
	setDefaultLabel: string;
	editLabel: string;
	deleteLabel: string;
	confirmLabel: string;
	busy: boolean;
	onEdit: () => void;
	onDelete: () => void;
	onSetDefault: () => void;
}) {
	return (
		<div className="hk-row">
			<div className="hk-row-grow">
				<span className="hk-row-title">
					{address.name || address.company || '—'}
					{isDefault && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{defaultLabel}</span>}
				</span>
				{address.company && address.name && <span className="hk-row-sub">{address.company}</span>}
				{addressOneLine(address) && <span className="hk-row-sub">{addressOneLine(address)}</span>}
				{address.telephone && <span className="hk-row-sub">{address.telephone}</span>}
				{canSetDefault && (
					<button type="button" className="hk-linkbtn" disabled={busy} onClick={onSetDefault} style={{ marginTop: 'var(--hk-s1)' }}>{setDefaultLabel}</button>
				)}
			</div>
			<div className="hk-row-rt" style={{ flexDirection: 'row', gap: 'var(--hk-s2)' }}>
				<Button variant="default" size="sm" disabled={busy} onClick={onEdit}>{editLabel}</Button>
				<DeleteButton mode="icon" disabled={busy} label={deleteLabel} confirmMessage={confirmLabel} onConfirm={onDelete} />
			</div>
		</div>
	);
}
