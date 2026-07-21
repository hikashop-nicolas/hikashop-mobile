import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useI18n, tError } from '../i18n';
import type { OrderDetail as OrderDetailType, OrderAddress, ProductField, FieldFile } from '../core';
import { WRITABLE_FIELD_TYPES } from '../core';
import { Screen, StatusChip, Money, Spinner, Icon, Button, CustomFieldInput } from '../ui';
import { fmtDate } from '../app/utils';

// Standard HikaShop statuses offered as quick actions; the store validates the value.
const STATUSES = ['created', 'confirmed', 'shipped', 'cancelled', 'refunded'];

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

export function OrderDetail() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
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
		if (!client || !order || qtyBusy || quantity < 1) return;
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
						<div className="hk-row" style={{ alignItems: 'center' }}>
							<span className="hk-muted hk-row-grow">{t('order.items')}</span>
							<button className="hk-appbar-act" style={{ padding: 0 }} onClick={() => nav(`/orders/${orderId}/fees`)}>{t('order.adjustFees')}</button>
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

					{(order.payment_method || order.shipping_method || order.invoice_number) && (
						<div className="hk-card hk-card--pad">
							{order.payment_method && <InfoRow label={t('order.payment')} value={order.payment_method} />}
							{order.shipping_method && <InfoRow label={t('order.shippingMethod')} value={order.shipping_method} />}
							{order.invoice_number && (
								<InfoRow
									label={t('order.invoice')}
									value={order.invoice_number + (order.invoice_created ? ` · ${fmtDate(order.invoice_created, locale)}` : '')}
								/>
							)}
						</div>
					)}

					<div className="hk-card hk-card--pad">
						<span className="hk-muted">{t('order.changeStatus')}</span>
						<div style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap', marginTop: 'var(--hk-s2)' }}>
							{STATUSES.map((s) => (
								<button
									key={s}
									className={`hk-chip${s === order.status ? ' hk-on' : ''}`}
									disabled={!!busy}
									onClick={() => void changeStatus(s)}
								>
									{busy === s ? t('order.updating') : t(`status.${s}`)}
								</button>
							))}
						</div>
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
									onUpload={() => Promise.reject(new Error('unsupported'))}
									onFiles={(next) => setCustomFieldFiles(f.namekey, next)} />
							))}
							<Button variant="pri" style={{ marginTop: 'var(--hk-s2)' }} disabled={fieldsBusy} onClick={() => void saveFields()}>
								{fieldsBusy ? t('product.saving') : fieldsSaved ? t('product.saved') : t('common.save')}
							</Button>
							{fieldsErr && <div className="hk-error-note" style={{ marginTop: 'var(--hk-s3)' }}>{fieldsErr}</div>}
						</div>
					)}

					<AddressCard label={t('order.billing')} address={order.billing_address} />
					<AddressCard label={t('order.shippingAddress')} address={order.shipping_address} />

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

function AddressCard({ label, address }: { label: string; address: OrderAddress | null }) {
	if (!address) return null;
	return (
		<div className="hk-card hk-card--pad">
			<span className="hk-muted">{label}</span>
			<div>{address.name}</div>
			{address.company && <div className="hk-row-sub">{address.company}</div>}
			<div className="hk-row-sub">{address.street}, {address.post_code} {address.city}</div>
		</div>
	);
}
