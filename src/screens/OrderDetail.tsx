import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useI18n, tError } from '../i18n';
import type { OrderDetail as OrderDetailType, OrderAddress, ProductField, FieldFile } from '../core';
import { WRITABLE_FIELD_TYPES } from '../core';
import { Screen, StatusChip, Money, Spinner, Icon, Button, CustomFieldInput } from '../ui';
import { fmtDate } from '../app/utils';
import { AddProductModal } from './AddProductModal';
import { AddressEditModal } from './AddressEditModal';
import { useStatuses } from '../app/statuses';

// Standard HikaShop statuses offered as quick actions; the store validates the value.
function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

export function OrderDetail() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
	const { statuses, statusLabel } = useStatuses();
	const storeId = active?.id ?? '';
	const orderId = Number(id);

	const { data: fetched, loading, error } = useCached<OrderDetailType>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getOrderDetail(storeId, orderId),
		fetch: () => client!.getOrder(orderId),
		write: async (o) => { await cache.putOrderDetail(storeId, orderId, o); },
		deps: [storeId, orderId],
	});

	// Local copy so a status change reflects instantly without a full reload.
	const [order, setOrder] = useState<OrderDetailType | null>(null);
	const [custom, setCustom] = useState<Record<string, string>>({});
	const [customFiles, setCustomFiles] = useState<Record<string, FieldFile[]>>({});
	useEffect(() => {
		if (!fetched) return;
		setOrder(fetched);
		const cf: Record<string, string> = {};
		for (const [k, v] of Object.entries(fetched.custom_fields ?? {})) cf[k] = v ?? '';
		setCustom(cf);
		setCustomFiles(fetched.custom_field_files ?? {});
	}, [fetched]);

	const [notify, setNotify] = useState(false);
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState('');
	const [updateErr, setUpdateErr] = useState('');
	const [qtyBusy, setQtyBusy] = useState(0);
	const [addingProduct, setAddingProduct] = useState(false);
	const [editingAddress, setEditingAddress] = useState<null | 'billing' | 'shipping'>(null);

	const [fieldsBusy, setFieldsBusy] = useState(false);
	const [fieldsErr, setFieldsErr] = useState('');
	const [fieldsSaved, setFieldsSaved] = useState(false);

	const fields: ProductField[] = order?.fields ?? [];
	const isWritable = (f: ProductField) => WRITABLE_FIELD_TYPES.includes(f.type);

	function setCustomField(namekey: string, value: string) {
		setCustom((c) => ({ ...c, [namekey]: value }));
		setFieldsSaved(false);
	}
	// An ajax field's column value is the pipe-joined path list of its files.
	function setCustomFieldFiles(namekey: string, next: FieldFile[]) {
		setCustomFiles((cf) => ({ ...cf, [namekey]: next }));
		setCustom((c) => ({ ...c, [namekey]: next.map((f) => f.path).join('|') }));
		setFieldsSaved(false);
	}

	async function persist(next: OrderDetailType) {
		setOrder(next);
		await cache.putOrderDetail(storeId, orderId, next);
	}

	async function saveFields() {
		if (!client || !order || fieldsBusy) return;
		setFieldsErr('');
		setFieldsBusy(true);
		try {
			const out: Record<string, string> = {};
			for (const f of fields) if (isWritable(f) && f.namekey in custom) out[f.namekey] = custom[f.namekey] ?? '';
			const res = await client.saveOrderFields(orderId, out);
			await persist({ ...order, custom_fields: res.custom_fields, custom_field_files: res.custom_field_files });
			setFieldsSaved(true);
		} catch (e) {
			setFieldsErr(tError(t, codeOf(e)));
		} finally {
			setFieldsBusy(false);
		}
	}

	async function changeStatus(status: string) {
		if (!client || !order || busy || status === order.status) return;
		setUpdateErr('');
		setBusy(status);
		try {
			await client.setOrderStatus(orderId, status, { notify, reason: reason.trim() });
			const now = Math.floor(Date.now() / 1000);
			await persist({
				...order,
				status,
				history: [{ status, created: now, type: 'update', reason: reason.trim(), notified: notify }, ...order.history],
			});
			setReason('');
		} catch (e) {
			setUpdateErr(tError(t, codeOf(e)));
		} finally {
			setBusy('');
		}
	}

	async function changeQty(lineId: number, quantity: number) {
		if (!client || !order || qtyBusy || quantity < 0) return;
		setUpdateErr('');
		setQtyBusy(lineId);
		try {
			const res = await client.setOrderProductQuantity(orderId, lineId, quantity);
			await persist({ ...order, items: res.items, totals: res.totals });
		} catch (e) {
			setUpdateErr(tError(t, codeOf(e)));
		} finally {
			setQtyBusy(0);
		}
	}

	return (
		<Screen
			title={order ? t('order.title', { number: order.number }) : t('order.titleFallback')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={order ? <StatusChip status={order.status} /> : undefined}
		>
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : order ? (
				<div className="hk-bento">
					<div className="hk-card hk-card--pad">
						<div className="hk-row-title">{order.customer.name || t('common.guest')}</div>
						<div className="hk-row-sub">{order.customer.email}</div>
					</div>

					<div className="hk-card hk-card--pad">
						<div className="hk-card-head">
							<span className="hk-muted hk-row-grow">{t('order.items')}</span>
							<Button variant="pri" size="sm" onClick={() => setAddingProduct(true)}><Icon name="plus" size={16} /> {t('order.addProduct')}</Button>
						</div>
						{order.items.map((it, i) => (
							<div key={i} className="hk-row">
								<div className="hk-row-grow">
									<span className="hk-row-title">{it.name}</span>
									<span className="hk-row-sub">{it.code || ' '}</span>
								</div>
								{it.editable ? (
									<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--hk-s2)' }}>
										<button className="hk-iconbtn" disabled={!!qtyBusy || it.quantity <= 1} aria-label={t('order.decrease')} onClick={() => void changeQty(it.id, it.quantity - 1)}>−</button>
										<span style={{ minWidth: '1.5em', textAlign: 'center' }}>{qtyBusy === it.id ? '…' : it.quantity}</span>
										<button className="hk-iconbtn" disabled={!!qtyBusy} aria-label={t('order.increase')} onClick={() => void changeQty(it.id, it.quantity + 1)}>+</button>
										<Money value={it.price * it.quantity} currency={order.currency_id} />
										<button className="hk-iconbtn" disabled={!!qtyBusy} aria-label={t('common.delete')} onClick={() => void changeQty(it.id, 0)}><Icon name="trash" size={18} /></button>
									</div>
								) : (
									<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--hk-s2)' }}>
										<span className="hk-row-sub">{t('order.qty', { count: it.quantity })}</span>
										<Money value={it.price * it.quantity} currency={order.currency_id} />
									</div>
								)}
							</div>
						))}
						{order.totals.discount > 0 && (
							<TotalRow label={t('order.discount')} value={-order.totals.discount} currency={order.currency_id} />
						)}
						{order.totals.shipping > 0 && (
							<TotalRow label={t('order.shipping')} value={order.totals.shipping} currency={order.currency_id} />
						)}
						{order.totals.payment > 0 && (
							<TotalRow label={t('order.paymentFee')} value={order.totals.payment} currency={order.currency_id} />
						)}
						{order.totals.tax > 0 && (
							<TotalRow label={t('order.tax')} value={order.totals.tax} currency={order.currency_id} />
						)}
						<div className="hk-row">
							<div className="hk-row-grow"><span className="hk-row-title">{t('order.total')}</span></div>
							<span className="hk-row-title"><Money value={order.totals.total} currency={order.currency_id} /></span>
						</div>
					</div>

					<div className="hk-card hk-card--pad">
						<div className="hk-card-head">
							<span className="hk-muted hk-row-grow">{t('order.feesAndMethods')}</span>
							<Button variant="pri" size="sm" onClick={() => nav(`/orders/${orderId}/fees`)}><Icon name="edit" size={15} /> {t('order.adjustFees')}</Button>
						</div>
						{order.payment_method && <InfoRow label={t('order.payment')} value={order.payment_method} />}
						{order.shipping_method && <InfoRow label={t('order.shippingMethod')} value={order.shipping_method} />}
						{order.invoice_number && (
							<InfoRow
								label={t('order.invoice')}
								value={order.invoice_number + (order.invoice_created ? ` · ${fmtDate(order.invoice_created, locale)}` : '')}
							/>
						)}
					</div>

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('order.changeStatus')}</span>
						<select
							className="hk-select"
							style={{ width: '100%', marginTop: 'var(--hk-s2)' }}
							value={order.status}
							disabled={!!busy}
							onChange={(e) => void changeStatus(e.target.value)}
						>
							{statuses.map((s) => (
								<option key={s.namekey} value={s.namekey}>{statusLabel(s.namekey)}</option>
							))}
						</select>
						<input
							className="hk-input"
							style={{ marginTop: 'var(--hk-s3)' }}
							placeholder={t('order.reasonOptional')}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							disabled={!!busy}
						/>
						<label className="hk-check">
							<input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={!!busy} />
							<span>{t('order.notifyCustomer')}</span>
						</label>
						{updateErr && <div className="hk-error-note" style={{ marginTop: 'var(--hk-s3)' }}>{updateErr}</div>}
					</div>

					{fields.length > 0 && (
						<div className="hk-card hk-card--pad hk-form">
							<span className="hk-muted">{t('order.fields')}</span>
							{fields.map((f) => (
								<CustomFieldInput key={f.namekey} field={f} value={custom[f.namekey] ?? ''} files={customFiles[f.namekey] ?? []}
									readOnlyLabel={t('product.fieldReadOnly')}
									onChange={(v) => setCustomField(f.namekey, v)}
									onUpload={(data, name) => client!.uploadFieldFile('order', f.namekey, { data, name })}
									onFiles={(next) => setCustomFieldFiles(f.namekey, next)} />
							))}
							<Button variant="pri" style={{ marginTop: 'var(--hk-s2)' }} disabled={fieldsBusy} onClick={() => void saveFields()}>
								{fieldsBusy ? t('product.saving') : fieldsSaved ? t('product.saved') : t('common.save')}
							</Button>
							{fieldsErr && <div className="hk-error-note" style={{ marginTop: 'var(--hk-s3)' }}>{fieldsErr}</div>}
						</div>
					)}

					<AddressCard label={t('order.billing')} address={order.billing_address} editLabel={t('product.edit')} onEdit={() => setEditingAddress('billing')} />
					<AddressCard label={t('order.shippingAddress')} address={order.shipping_address} editLabel={t('product.edit')} onEdit={() => setEditingAddress('shipping')} />

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('order.history')}</span>
						{order.history.map((h, i) => (
							<div key={i} className="hk-row">
								<div className="hk-row-grow">
									<StatusChip status={h.status} />
									{h.reason && <span className="hk-row-sub" style={{ marginTop: 'var(--hk-s1)' }}>{h.reason}</span>}
								</div>
								<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--hk-s2)' }}>
									{h.notified && <Icon name="bell" size={16} className="hk-muted" />}
									<span className="hk-row-sub">{fmtDate(h.created, locale)}</span>
								</div>
							</div>
						))}
					</div>
				</div>
			) : null}
			{addingProduct && order && (
				<AddProductModal
					orderId={orderId}
					currencyId={order.currency_id}
					taxRates={order.tax_rates}
					onClose={() => setAddingProduct(false)}
					onAdded={(items, totals) => { void persist({ ...order, items, totals }); setAddingProduct(false); }}
				/>
			)}
			{editingAddress && order && (
				<AddressEditModal
					orderId={orderId}
					type={editingAddress}
					onClose={() => setEditingAddress(null)}
					onSaved={(summary) => {
						void persist(editingAddress === 'billing' ? { ...order, billing_address: summary } : { ...order, shipping_address: summary });
						setEditingAddress(null);
					}}
				/>
			)}
		</Screen>
	);
}

function TotalRow({ label, value, currency }: { label: string; value: number; currency: number }) {
	return (
		<div className="hk-row">
			<div className="hk-row-grow"><span className="hk-row-sub">{label}</span></div>
			<Money value={value} currency={currency} />
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="hk-row">
			<div className="hk-row-grow"><span className="hk-row-sub">{label}</span></div>
			<span>{value}</span>
		</div>
	);
}

function AddressCard({ label, address, editLabel, onEdit }: { label: string; address: OrderAddress | null; editLabel: string; onEdit: () => void }) {
	return (
		<div className="hk-card hk-card--pad">
			<div className="hk-card-head">
				<span className="hk-muted hk-row-grow">{label}</span>
				<Button size="sm" onClick={onEdit}>{editLabel}</Button>
			</div>
			{address && (
				<>
					<div>{address.name}</div>
					{address.company && <div className="hk-row-sub">{address.company}</div>}
					<div className="hk-row-sub">{address.street}, {address.post_code} {address.city}</div>
				</>
			)}
		</div>
	);
}
