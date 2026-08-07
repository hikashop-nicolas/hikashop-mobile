import { useEffect, useRef, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { OrderAddressForm, OrderAddress, ProductField, ZoneItem } from '../core';
import { Modal, Field, Button, Spinner } from '../ui';
import { SearchPicker } from './SearchPicker';

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

// Edit an order's billing or shipping address. Text fields, a title dropdown, and country /
// state zone pickers (state scoped to the chosen country).
export function AddressEditModal({ orderId, type, onClose, onSaved }: {
	orderId: number;
	type: 'billing' | 'shipping';
	onClose: () => void;
	onSaved: (summary: OrderAddress) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [form, setForm] = useState<OrderAddressForm | null>(null);
	const [values, setValues] = useState<Record<string, string>>({});
	const [countryName, setCountryName] = useState('');
	const [stateName, setStateName] = useState('');
	const [picking, setPicking] = useState<null | 'country' | 'state'>(null);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const zoneMap = useRef<Map<number, ZoneItem>>(new Map());

	useEffect(() => {
		let alive = true;
		void (async () => {
			try {
				const f = await client!.getOrderAddress(orderId, type);
				if (!alive) return;
				setForm(f);
				setValues({ ...f.values });
				setCountryName(f.country_name);
				setStateName(f.state_name);
			} catch (e) { if (alive) setErr(tError(t, codeOf(e))); }
		})();
		return () => { alive = false; };
	}, [orderId, type, client, t]);

	const set = (nk: string, v: string) => setValues((s) => ({ ...s, [nk]: v }));

	async function save() {
		if (!client || busy) return;
		setErr('');
		setBusy(true);
		try {
			const res = await client.saveOrderAddress(orderId, type, values);
			onSaved(res.summary);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	if (picking === 'country') {
		return (
			<SearchPicker
				title={t('address.country')} placeholder={t('address.searchCountry')} minChars={1}
				search={async (q) => { const r = await client!.getZones({ type: 'country', search: q }); r.forEach((z) => zoneMap.current.set(z.id, z)); return r.map((z) => ({ id: z.id, label: z.name })); }}
				onClose={() => setPicking(null)}
				onPick={(item) => { const z = zoneMap.current.get(item.id); if (z) { set('address_country', z.namekey); setCountryName(z.name); set('address_state', ''); setStateName(''); } setPicking(null); }}
			/>
		);
	}
	if (picking === 'state') {
		const parent = values.address_country || '';
		return (
			<SearchPicker
				title={t('address.state')} placeholder={t('address.searchState')} minChars={0}
				search={async (q) => { const r = await client!.getZones({ type: 'state', parent, search: q }); r.forEach((z) => zoneMap.current.set(z.id, z)); return r.map((z) => ({ id: z.id, label: z.name })); }}
				onClose={() => setPicking(null)}
				onPick={(item) => { const z = zoneMap.current.get(item.id); if (z) { set('address_state', z.namekey); setStateName(z.name); } setPicking(null); }}
			/>
		);
	}

	return (
		<Modal title={type === 'billing' ? t('order.billing') : t('order.shippingAddress')} onClose={onClose}>
			{!form ? (
				<div className="hk-center-col"><Spinner /></div>
			) : (
				<div className="hk-form">
					{form.fields.map((f: ProductField) => {
						if (f.namekey === 'address_country') {
							return (
								<Field key={f.namekey} label={f.label}>
									<button type="button" className="hk-input" onClick={() => setPicking('country')} style={{ textAlign: 'left' }}>
										{countryName || t('address.choose')}
									</button>
								</Field>
							);
						}
						if (f.namekey === 'address_state') {
							return (
								<Field key={f.namekey} label={f.label}>
									<button type="button" className="hk-input" disabled={!values.address_country} onClick={() => setPicking('state')} style={{ textAlign: 'left' }}>
										{stateName || t('address.choose')}
									</button>
								</Field>
							);
						}
						if (f.type === 'singledropdown') {
							return (
								<Field key={f.namekey} label={f.label}>
									<select className="hk-select" value={values[f.namekey] ?? ''} onChange={(e) => set(f.namekey, e.target.value)}>
										<option value="">{t('address.choose')}</option>
										{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
									</select>
								</Field>
							);
						}
						return (
							<Field key={f.namekey} label={f.label}>
								<input className="hk-input" type="text" value={values[f.namekey] ?? ''} onChange={(e) => set(f.namekey, e.target.value)} />
							</Field>
						);
					})}
					{err && <div className="hk-error-note">{err}</div>}
					<Button variant="pri" block disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</Button>
				</div>
			)}
		</Modal>
	);
}
