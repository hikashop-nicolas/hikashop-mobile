import { useStores } from '../app/store-context';
import { useT } from '../i18n';
import type { CustomerDetail } from '../core';
import { AddressFormModal } from './AddressFormModal';

// Create or edit an entry in a customer's address book, via the shared address form.
// addressId = 0 creates a new address of the given type(s). onSaved receives the refreshed customer.
export function CustomerAddressModal({ customerId, addressId, types, onClose, onSaved }: {
	customerId: number;
	addressId: number;
	types: string[];
	onClose: () => void;
	onSaved: (customer: CustomerDetail) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const isNew = addressId <= 0;
	const label = types.includes('shipping') && !types.includes('billing') ? t('customers.shipping') : t('customers.billing');
	return (
		<AddressFormModal<CustomerDetail>
			title={isNew ? t('customers.addAddress', { type: label }) : label}
			load={() => client!.getCustomerAddress(customerId, addressId)}
			onSave={(values) => client!.saveCustomerAddress(customerId, addressId, { fields: values, types })}
			onClose={onClose}
			onSaved={onSaved}
		/>
	);
}
