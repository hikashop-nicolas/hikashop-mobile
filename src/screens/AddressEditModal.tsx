import { useStores } from '../app/store-context';
import { useT } from '../i18n';
import type { OrderAddress } from '../core';
import { AddressFormModal } from './AddressFormModal';

// Edit an order's billing or shipping address, via the shared address form.
export function AddressEditModal({ orderId, type, onClose, onSaved }: {
	orderId: number;
	type: 'billing' | 'shipping';
	onClose: () => void;
	onSaved: (summary: OrderAddress) => void;
}) {
	const { client } = useStores();
	const t = useT();
	return (
		<AddressFormModal<{ summary: OrderAddress }>
			title={type === 'billing' ? t('order.billing') : t('order.shippingAddress')}
			load={() => client!.getOrderAddress(orderId, type)}
			onSave={(values) => client!.saveOrderAddress(orderId, type, values)}
			onClose={onClose}
			onSaved={(res) => onSaved(res.summary)}
		/>
	);
}
