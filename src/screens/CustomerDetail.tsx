import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useI18n, tError } from '../i18n';
import type { CustomerDetail as CustomerDetailType, CustomerAddress } from '../core';
import { Screen, StatusChip, Money, Spinner, Icon } from '../ui';
import { fmtDate } from '../app/utils';

export function CustomerDetail() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const { t, locale } = useI18n();
	const storeId = active?.id ?? '';
	const customerId = Number(id);

	const { data: customer, loading, error } = useCached<CustomerDetailType>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getCustomer(storeId, customerId),
		fetch: () => client!.getCustomer(customerId),
		write: async (c) => { await cache.putCustomer(storeId, customerId, c); },
		deps: [storeId, customerId],
	});

	return (
		<Screen
			title={customer ? (customer.name || customer.email || t('common.guest')) : t('customers.detailTitle')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
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
							{customer.type === 'guest' && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('customers.guest')}</span>}
						</div>
						<div className="hk-row-sub">{customer.email}</div>
						<div className="hk-row-sub">{t('customers.since', { date: fmtDate(customer.created, locale) })}</div>
					</div>

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

					<div className="hk-card hk-card--pad">
						<div className="hk-card-head">
							<span className="hk-muted hk-row-grow">{t('customers.addresses')}</span>
						</div>
						{customer.addresses.length === 0 ? (
							<div className="hk-row-sub">{t('customers.noAddresses')}</div>
						) : customer.addresses.map((a) => <AddressBlock key={a.id} address={a} defaultLabel={t('customers.defaultAddress')} />)}
					</div>
				</>
			)}
		</Screen>
	);
}

function AddressBlock({ address, defaultLabel }: { address: CustomerAddress; defaultLabel: string }) {
	return (
		<div className="hk-row">
			<div className="hk-row-grow">
				<span className="hk-row-title">
					{address.name || address.company || '—'}
					{address.default && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{defaultLabel}</span>}
				</span>
				{address.company && address.name && <span className="hk-row-sub">{address.company}</span>}
				{address.street && <span className="hk-row-sub">{address.street}, {address.post_code} {address.city}</span>}
				{address.telephone && <span className="hk-row-sub">{address.telephone}</span>}
			</div>
		</div>
	);
}
