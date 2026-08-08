import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { ProductDetail, ProductMeta, ProductPrice, Settings } from '../core';
import { tsToDate, dateToTs, inclFromExcl, exclFromIncl } from '../core';
import { Screen, Spinner, Icon, Field, Button, DeleteButton } from '../ui';
import { SearchPicker } from './SearchPicker';
import type { PickItem } from './SearchPicker';

// A row keeps the tax-exclusive value (what HikaShop stores) and preserves the
// users/zone restrictions so an edit never wipes them.
type Row = {
	value: string; currency_id: number; min_quantity: string; access: string;
	start: string; end: string; users: number[]; zone_ids: number[];
};

const toRow = (p: ProductPrice): Row => ({
	value: String(p.value), currency_id: p.currency_id, min_quantity: String(p.min_quantity || ''),
	access: p.access || 'all', start: tsToDate(p.start_date), end: tsToDate(p.end_date),
	users: p.users ?? [], zone_ids: p.zone_ids ?? [],
});

export function ProductPricesEdit() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const t = useT();
	const storeId = active?.id ?? '';
	const productId = Number(id);

	const { data: product, loading, error } = useCached<ProductDetail>({
		enabled: !!client && !!active && !!id,
		read: () => cache.getProduct(storeId, productId),
		fetch: () => client!.getProduct(productId),
		write: async (p) => { await cache.putProduct(storeId, productId, p); },
		deps: [storeId, productId],
	});
	const { data: meta } = useCached<ProductMeta>({
		enabled: !!client && !!active,
		read: () => cache.getProductMeta(storeId),
		fetch: () => client!.getProductMeta(),
		write: async (m) => { await cache.putProductMeta(storeId, m); },
		deps: [storeId],
	});
	const { data: settings } = useCached<Settings>({
		enabled: !!client && !!active,
		read: () => cache.getSettings(storeId),
		fetch: () => client!.getSettings(),
		write: async (s) => { await cache.putSettings(storeId, s); },
		deps: [storeId],
	});

	const [rows, setRows] = useState<Row[] | null>(null);
	useEffect(() => { if (product && !rows) setRows(product.prices.map(toRow)); }, [product, rows]);

	// Resolve the ids used in the loaded restrictions to display names.
	const [userNames, setUserNames] = useState<Record<number, string>>({});
	const [zoneNames, setZoneNames] = useState<Record<number, string>>({});
	useEffect(() => {
		if (!client || !product) return;
		const uids = [...new Set(product.prices.flatMap((p) => p.users ?? []))];
		const zids = [...new Set(product.prices.flatMap((p) => p.zone_ids ?? []))];
		let alive = true;
		void (async () => {
			if (uids.length) { try { const u = await client.getUsers({ ids: uids }); if (alive) setUserNames(Object.fromEntries(u.map((x) => [x.id, x.name || x.email]))); } catch { /* ignore */ } }
			if (zids.length) { try { const z = await client.getZones({ ids: zids }); if (alive) setZoneNames(Object.fromEntries(z.map((x) => [x.id, x.name]))); } catch { /* ignore */ } }
		})();
		return () => { alive = false; };
	}, [client, product]);

	const [busy, setBusy] = useState(false);
	const [saveErr, setSaveErr] = useState('');
	const [restrictRow, setRestrictRow] = useState<number | null>(null);
	const [picking, setPicking] = useState<{ row: number; kind: 'users' | 'zones' } | null>(null);
	const defaultCurrency = meta?.currencies[0]?.id ?? 1;

	// Tax entry: the product carries the tax rate; when the shop enters prices with tax
	// (price_with_tax) or the tax is fixed, show a linked incl-tax field. When the tax
	// floats by zone (floating_tax_prices) HikaShop enters only the incl-tax amount.
	const taxRate = product?.tax_rate ?? 0;
	const showTax = taxRate > 0 && (settings?.price_with_tax || settings?.floating_tax_prices);
	const floating = !!settings?.floating_tax_prices;

	function update(i: number, patch: Partial<Row>) {
		setRows((r) => (r ? r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)) : r));
	}
	// Editing the incl-tax field stores the derived excl-tax value.
	function updateIncl(i: number, inclStr: string) {
		const incl = Number(inclStr);
		update(i, { value: inclStr.trim() === '' ? '' : String(exclFromIncl(incl, taxRate)) });
	}
	function add() {
		setRows((r) => [...(r ?? []), { value: '', currency_id: defaultCurrency, min_quantity: '', access: 'all', start: '', end: '', users: [], zone_ids: [] }]);
	}
	function remove(i: number) {
		setRows((r) => (r ? r.filter((_, idx) => idx !== i) : r));
	}
	function removeRestriction(i: number, kind: 'users' | 'zones', id: number) {
		update(i, kind === 'users'
			? { users: (rows?.[i].users ?? []).filter((x) => x !== id) }
			: { zone_ids: (rows?.[i].zone_ids ?? []).filter((x) => x !== id) });
	}
	function addRestriction(item: PickItem) {
		if (!picking) return;
		const { row, kind } = picking;
		const cur = kind === 'users' ? rows![row].users : rows![row].zone_ids;
		if (!cur.includes(item.id)) {
			update(row, kind === 'users' ? { users: [...cur, item.id] } : { zone_ids: [...cur, item.id] });
			if (kind === 'users') setUserNames((m) => ({ ...m, [item.id]: item.label }));
			else setZoneNames((m) => ({ ...m, [item.id]: item.label }));
		}
		setPicking(null);
	}

	async function save() {
		if (!client || !rows || busy) return;
		setSaveErr('');
		setBusy(true);
		try {
			const prices = rows
				.filter((r) => r.value.trim() !== '')
				.map((r) => ({
					value: Number(r.value) || 0, currency_id: r.currency_id, min_quantity: Number(r.min_quantity) || 0,
					access: r.access || 'all', start_date: dateToTs(r.start), end_date: dateToTs(r.end),
					users: r.users, zone_ids: r.zone_ids,
				}));
			const updated = await client.setProductPrices(productId, prices);
			if (product) await cache.putProduct(storeId, productId, { ...product, prices: updated });
			nav(-1);
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setSaveErr(tError(t, code));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen
			title={t('product.editPrices')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={rows ? <Button variant="pri" size="sm" disabled={busy} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</Button> : undefined}
		>
			{loading || !rows ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : (
				<>
					{rows.map((r, i) => {
						const incl = r.value.trim() === '' ? '' : String(inclFromExcl(Number(r.value), taxRate));
						const restricted = r.users.length + r.zone_ids.length > 0;
						return (
							<div key={i} className="hk-card hk-card--pad hk-form">
								{!floating && (
									<div className="hk-form-row">
										<Field label={showTax ? t('product.valueExclTax') : t('product.value')}><input className="hk-input" type="number" inputMode="decimal" value={r.value} onChange={(e) => update(i, { value: e.target.value })} /></Field>
										<Field label={t('product.currency')}>
											<select className="hk-select" value={r.currency_id} onChange={(e) => update(i, { currency_id: Number(e.target.value) })}>
												{(meta?.currencies ?? []).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
											</select>
										</Field>
									</div>
								)}
								{showTax && (
									<div className="hk-form-row">
										<Field label={t('product.valueInclTax')}><input className="hk-input" type="number" inputMode="decimal" value={incl} onChange={(e) => updateIncl(i, e.target.value)} /></Field>
										{floating && (
											<Field label={t('product.currency')}>
												<select className="hk-select" value={r.currency_id} onChange={(e) => update(i, { currency_id: Number(e.target.value) })}>
													{(meta?.currencies ?? []).map((c) => <option key={c.id} value={c.id}>{c.code}</option>)}
												</select>
											</Field>
										)}
									</div>
								)}
								<div className="hk-form-row">
									<Field label={t('product.minQuantity')}><input className="hk-input" type="number" inputMode="numeric" value={r.min_quantity} onChange={(e) => update(i, { min_quantity: e.target.value })} /></Field>
									<Field label={t('product.access')}>
										<select className="hk-select" value={r.access} onChange={(e) => update(i, { access: e.target.value })}>
											<option value="all">{t('product.allUsers')}</option>
											{(meta?.access_levels ?? []).map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
										</select>
									</Field>
								</div>
								<div className="hk-form-row">
									<Field label={t('product.priceStart')}><input className="hk-input" type="date" value={r.start} onChange={(e) => update(i, { start: e.target.value })} /></Field>
									<Field label={t('product.priceEnd')}><input className="hk-input" type="date" value={r.end} onChange={(e) => update(i, { end: e.target.value })} /></Field>
								</div>
								<div>
									<button type="button" className="hk-appbar-act" style={{ padding: 0 }} onClick={() => setRestrictRow(restrictRow === i ? null : i)}>
										{t('product.restrictions')}{restricted ? ` (${r.users.length + r.zone_ids.length})` : ''} <Icon name="chevron" size={14} className={restrictRow === i ? 'hk-rot90' : ''} />
									</button>
									{restrictRow === i && (
										<div className="hk-form" style={{ marginTop: 'var(--hk-s2)' }}>
											<Field label={t('product.restrictUsers')}>
												<div className="hk-chip-row">
													{r.users.map((uid) => (
														<button key={uid} type="button" className="hk-chip hk-on" onClick={() => removeRestriction(i, 'users', uid)}>{userNames[uid] ?? `#${uid}`} <Icon name="close" size={12} /></button>
													))}
													<button type="button" className="hk-chip" onClick={() => setPicking({ row: i, kind: 'users' })}><Icon name="plus" size={13} /> {t('common.add')}</button>
												</div>
											</Field>
											<Field label={t('product.restrictZones')}>
												<div className="hk-chip-row">
													{r.zone_ids.map((zid) => (
														<button key={zid} type="button" className="hk-chip hk-on" onClick={() => removeRestriction(i, 'zones', zid)}>{zoneNames[zid] ?? `#${zid}`} <Icon name="close" size={12} /></button>
													))}
													<button type="button" className="hk-chip" onClick={() => setPicking({ row: i, kind: 'zones' })}><Icon name="plus" size={13} /> {t('common.add')}</button>
												</div>
											</Field>
										</div>
									)}
								</div>
								<DeleteButton size="sm" label={t('common.delete')}
									confirmMessage={t('product.deletePriceConfirm')} onConfirm={() => remove(i)} />
							</div>
						);
					})}
					<Button block onClick={add}><Icon name="plus" size={18} /> {t('product.addPrice')}</Button>
					{saveErr && <div className="hk-error-note">{saveErr}</div>}
					{picking && picking.kind === 'users' && (
						<SearchPicker title={t('product.restrictUsers')} placeholder={t('product.searchUsers')} minChars={2}
							excludeIds={rows?.[picking.row].users ?? []}
							search={(q) => client!.getUsers({ search: q }).then((u) => u.map((x) => ({ id: x.id, label: x.name || x.email, sub: x.name ? x.email : undefined })))}
							onClose={() => setPicking(null)} onPick={addRestriction} />
					)}
					{picking && picking.kind === 'zones' && (
						<SearchPicker title={t('product.restrictZones')} placeholder={t('product.searchZones')} minChars={2}
							excludeIds={rows?.[picking.row].zone_ids ?? []}
							search={(q) => client!.getZones({ search: q }).then((z) => z.map((x) => ({ id: x.id, label: x.name, sub: x.type })))}
							onClose={() => setPicking(null)} onPick={addRestriction} />
					)}
				</>
			)}
		</Screen>
	);
}
