import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { Discount, DiscountInput, DiscountType, Access, CategoryListItem } from '../core';
import { Screen, Spinner, Field, Button, Icon, DeleteButton, TreeSelect } from '../ui';
import { validateDiscount } from '../app/discounts';
import { IdChips } from './IdChips';
import { AccessField } from './AccessField';

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

// unix seconds <-> yyyy-mm-dd for the native date inputs (day granularity, local time).
function toDateInput(unix: number): string {
	if (!unix) return '';
	const d = new Date(unix * 1000);
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function fromDateInput(s: string): number {
	if (!s) return 0;
	const [y, m, d] = s.split('-').map(Number);
	return Math.floor(new Date(y, m - 1, d).getTime() / 1000);
}

const numOr0 = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(',', '.')) || 0);
const intOr0 = (s: string) => (s.trim() === '' ? 0 : parseInt(s, 10) || 0);
const show = (n: number) => (n ? String(n) : '');

export function DiscountEdit() {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active, cache } = useStores();
	const t = useT();
	const storeId = active?.id ?? '';
	const editing = !!id;

	const [loaded, setLoaded] = useState(!editing);
	const [type, setType] = useState<DiscountType>('coupon');
	const [code, setCode] = useState('');
	const [kind, setKind] = useState<'percent' | 'flat'>('percent');
	const [value, setValue] = useState('');
	const [published, setPublished] = useState(true);
	const [start, setStart] = useState('');
	const [end, setEnd] = useState('');
	const [shippingPercent, setShippingPercent] = useState('');

	// Restrictions
	const [minOrder, setMinOrder] = useState('');
	const [maxOrder, setMaxOrder] = useState('');
	const [minProducts, setMinProducts] = useState('');
	const [maxProducts, setMaxProducts] = useState('');
	const [quota, setQuota] = useState('');
	const [perUser, setPerUser] = useState('');
	const [productIds, setProductIds] = useState<number[]>([]);
	const [excludeProductIds, setExcludeProductIds] = useState<number[]>([]);
	const [categoryIds, setCategoryIds] = useState<number[]>([]);
	const [categoryChilds, setCategoryChilds] = useState(false);
	const [excludeCategoryIds, setExcludeCategoryIds] = useState<number[]>([]);
	const [excludeCategoryChilds, setExcludeCategoryChilds] = useState(false);
	const [zoneIds, setZoneIds] = useState<number[]>([]);
	const [userIds, setUserIds] = useState<number[]>([]);
	const [access, setAccess] = useState<Access>({ mode: 'all', groups: [] });
	const [excludeAccess, setExcludeAccess] = useState<Access>({ mode: 'none', groups: [] });

	// Coupon behaviour
	const [autoLoad, setAutoLoad] = useState(false);
	const [productOnly, setProductOnly] = useState(false);
	const [discountedProducts, setDiscountedProducts] = useState(0);

	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const [showRestrictions, setShowRestrictions] = useState(false);

	// Categories are a tree, so they get a tree picker rather than a search box.
	const { data: categories } = useCached<CategoryListItem[]>({
		enabled: !!client && !!active,
		read: () => cache.getCategories(storeId, 'product'),
		fetch: () => client!.listCategories('product'),
		write: async (c) => { await cache.putCategories(storeId, 'product', c); },
		deps: [storeId],
	});
	useEffect(() => {
		if (!client || !editing) return;
		let alive = true;
		void (async () => {
			try {
				const d = await client.getDiscount(Number(id));
				if (!alive) return;
				setType(d.type); setCode(d.code); setKind(d.kind); setValue(String(d.value));
				setPublished(d.published);
				setStart(toDateInput(d.start)); setEnd(toDateInput(d.end));
				setShippingPercent(show(d.shipping_percent));
				setMinOrder(show(d.minimum_order)); setMaxOrder(show(d.maximum_order));
				setMinProducts(show(d.minimum_products)); setMaxProducts(show(d.maximum_products));
				setQuota(show(d.quota)); setPerUser(show(d.quota_per_user));
				setProductIds(d.product_ids); setExcludeProductIds(d.exclude_product_ids);
				setCategoryIds(d.category_ids); setCategoryChilds(d.category_childs);
				setExcludeCategoryIds(d.exclude_category_ids); setExcludeCategoryChilds(d.exclude_category_childs);
				setZoneIds(d.zone_ids); setUserIds(d.user_ids);
				setAccess(d.access); setExcludeAccess(d.exclude_access);
				setAutoLoad(d.auto_load); setProductOnly(d.product_only);
				setDiscountedProducts(d.discounted_products);
				// Open the section straight away when it already carries something.
				setShowRestrictions(
					d.product_ids.length > 0 || d.category_ids.length > 0 || d.zone_ids.length > 0 ||
					d.user_ids.length > 0 || d.exclude_product_ids.length > 0 || d.exclude_category_ids.length > 0 ||
					d.access.mode !== 'all' || d.exclude_access.mode !== 'none' ||
					!!d.minimum_products || !!d.maximum_products || !!d.maximum_order,
				);
			} catch (e) { if (alive) setErr(tError(t, codeOf(e))); }
			finally { if (alive) setLoaded(true); }
		})();
		return () => { alive = false; };
	}, [client, id, editing, t]);

	async function save() {
		if (!client || busy) return;
		const num = Number(value.replace(',', '.'));
		const verr = validateDiscount({ type, code, kind, value: num });
		if (verr) { setErr(t(verr)); return; }
		setErr('');
		setBusy(true);
		const input: DiscountInput = {
			type, code: code.trim(), kind, value: num, published,
			start: fromDateInput(start), end: fromDateInput(end),
			shipping_percent: numOr0(shippingPercent),
			minimum_order: numOr0(minOrder), maximum_order: numOr0(maxOrder),
			minimum_products: intOr0(minProducts), maximum_products: intOr0(maxProducts),
			quota: intOr0(quota), quota_per_user: intOr0(perUser),
			product_ids: productIds, exclude_product_ids: excludeProductIds,
			category_ids: categoryIds, category_childs: categoryChilds,
			exclude_category_ids: excludeCategoryIds, exclude_category_childs: excludeCategoryChilds,
			zone_ids: zoneIds, user_ids: userIds,
			access, exclude_access: excludeAccess,
			// Behaviour flags only mean anything for a coupon.
			...(type === 'coupon' ? { auto_load: autoLoad, product_only: productOnly, discounted_products: discountedProducts } : {}),
		};
		try {
			const saved: Discount = editing ? await client.updateDiscount(Number(id), input) : await client.createDiscount(input);
			await cache.putDiscount(storeId, saved.id, saved);
			nav('/discounts');
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	async function remove() {
		if (!client || busy || !editing) return;
		setBusy(true);
		try {
			await client.deleteDiscount(Number(id));
			nav('/discounts');
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	const catNodes = (categories ?? []).map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id }));

	return (
		<Screen
			title={editing ? code || t('discount.edit') : t('discounts.newDiscount')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={<Button variant="pri" size="sm" disabled={busy || !loaded} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</Button>}
		>
			{!loaded ? (
				<div className="hk-center-col"><Spinner /></div>
			) : (
				<>
					<div className="hk-card hk-card--pad hk-form">
						<Field label={t('discount.promotionType')} hint={type === 'coupon' ? t('discount.couponHint') : t('discount.autoHint')}>
							<div className="hk-segmented">
								<button type="button" className={`hk-seg${type === 'coupon' ? ' hk-on' : ''}`} onClick={() => setType('coupon')}>{t('discount.typeCoupon')}</button>
								<button type="button" className={`hk-seg${type === 'discount' ? ' hk-on' : ''}`} onClick={() => setType('discount')}>{t('discount.typeAuto')}</button>
							</div>
						</Field>
						{/* Both types carry a code. The customer types a coupon's; an automatic discount's
						    is its reference, as in the backend, and the shop names one if left blank. */}
						{type === 'coupon' ? (
							<Field label={t('discount.code')}>
								<input className="hk-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" />
							</Field>
						) : (
							<Field label={t('discount.reference')} hint={t('discount.referenceHint')}>
								<input className="hk-input" value={code} onChange={(e) => setCode(e.target.value)} />
							</Field>
						)}
						<Field label={t('discount.type')}>
							<div className="hk-segmented">
								<button type="button" className={`hk-seg${kind === 'percent' ? ' hk-on' : ''}`} onClick={() => setKind('percent')}>{t('discount.percent')}</button>
								<button type="button" className={`hk-seg${kind === 'flat' ? ' hk-on' : ''}`} onClick={() => setKind('flat')}>{t('discount.flat')}</button>
							</div>
						</Field>
						<Field label={kind === 'percent' ? t('discount.percentValue') : t('discount.flatValue')}>
							<input className="hk-input" type="number" inputMode="decimal" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
						</Field>
						<Field label={t('discount.shippingPercent')} hint={t('discount.shippingPercentHint')}>
							<input className="hk-input" type="number" inputMode="decimal" min="0" max="100" value={shippingPercent} onChange={(e) => setShippingPercent(e.target.value)} />
						</Field>
						<label className="hk-check">
							<input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
							<span>{t('discount.published')}</span>
						</label>
						<div className="hk-form-row">
							<Field label={t('discount.start')}>
								<input className="hk-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
							</Field>
							<Field label={t('discount.end')}>
								<input className="hk-input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
							</Field>
						</div>
					</div>

					{type === 'coupon' && (
						<div className="hk-card hk-card--pad hk-form">
							<div className="hk-card-head"><span className="hk-muted hk-row-grow">{t('discount.behaviour')}</span></div>
							<label className="hk-check">
								<input type="checkbox" checked={autoLoad} onChange={(e) => setAutoLoad(e.target.checked)} />
								<span>{t('discount.autoLoad')}</span>
							</label>
							<label className="hk-check">
								<input type="checkbox" checked={productOnly} onChange={(e) => setProductOnly(e.target.checked)} />
								<span>{t('discount.productOnly')}</span>
							</label>
							<Field label={t('discount.discountedProducts')}>
								<select className="hk-select" value={String(discountedProducts)} onChange={(e) => setDiscountedProducts(Number(e.target.value))}>
									<option value="0">{t('discount.dpStandard')}</option>
									<option value="1">{t('discount.dpIgnore')}</option>
									<option value="2">{t('discount.dpOverride')}</option>
								</select>
							</Field>
						</div>
					)}

					<div className="hk-card hk-card--pad hk-form">
						<div className="hk-card-head">
							<span className="hk-muted hk-row-grow">{t('discount.restrictions')}</span>
							<Button size="sm" onClick={() => setShowRestrictions((v) => !v)}>
								{showRestrictions ? t('discount.hide') : t('discount.show')}
							</Button>
						</div>

						{showRestrictions && (
							<>
								<div className="hk-form-row">
									<Field label={t('discount.minimumOrder')}>
										<input className="hk-input" type="number" inputMode="decimal" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
									</Field>
									<Field label={t('discount.maximumOrder')}>
										<input className="hk-input" type="number" inputMode="decimal" min="0" value={maxOrder} onChange={(e) => setMaxOrder(e.target.value)} />
									</Field>
								</div>
								<div className="hk-form-row">
									<Field label={t('discount.minimumProducts')}>
										<input className="hk-input" type="number" inputMode="numeric" min="0" value={minProducts} onChange={(e) => setMinProducts(e.target.value)} />
									</Field>
									<Field label={t('discount.maximumProducts')}>
										<input className="hk-input" type="number" inputMode="numeric" min="0" value={maxProducts} onChange={(e) => setMaxProducts(e.target.value)} />
									</Field>
								</div>
								<div className="hk-form-row">
									<Field label={t('discount.quota')} hint={t('discount.quotaHint')}>
										<input className="hk-input" type="number" inputMode="numeric" min="0" value={quota} onChange={(e) => setQuota(e.target.value)} />
									</Field>
									<Field label={t('discount.quotaPerUser')} hint={t('discount.quotaHint')}>
										<input className="hk-input" type="number" inputMode="numeric" min="0" value={perUser} onChange={(e) => setPerUser(e.target.value)} />
									</Field>
								</div>

								<IdChips
									label={t('discount.products')} hint={t('discount.productsHint')}
									ids={productIds} onChange={setProductIds}
									searchTitle={t('discount.products')} searchPlaceholder={t('products.search')} minChars={1}
									search={(q) => client!.getProducts({ search: q, limit: 20 }).then((p) => p.items.map((x) => ({ id: x.id, label: x.name, sub: x.code })))}
									resolve={(ids) => client!.getProducts({ ids, limit: 100 }).then((p) => p.items.map((x) => ({ id: x.id, label: x.name })))}
								/>
								<IdChips
									label={t('discount.excludedProducts')}
									ids={excludeProductIds} onChange={setExcludeProductIds}
									searchTitle={t('discount.excludedProducts')} searchPlaceholder={t('products.search')} minChars={1}
									search={(q) => client!.getProducts({ search: q, limit: 20 }).then((p) => p.items.map((x) => ({ id: x.id, label: x.name, sub: x.code })))}
									resolve={(ids) => client!.getProducts({ ids, limit: 100 }).then((p) => p.items.map((x) => ({ id: x.id, label: x.name })))}
								/>

								<Field label={t('discount.categories')}>
									<TreeSelect nodes={catNodes} selected={categoryIds} onChange={setCategoryIds}
										searchPlaceholder={t('product.searchCategories')} emptyLabel={t('product.noCategories')} />
								</Field>
								<label className="hk-check">
									<input type="checkbox" checked={categoryChilds} onChange={(e) => setCategoryChilds(e.target.checked)} />
									<span>{t('discount.includingSubCategories')}</span>
								</label>

								<Field label={t('discount.excludedCategories')}>
									<TreeSelect nodes={catNodes} selected={excludeCategoryIds} onChange={setExcludeCategoryIds}
										searchPlaceholder={t('product.searchCategories')} emptyLabel={t('product.noCategories')} />
								</Field>
								<label className="hk-check">
									<input type="checkbox" checked={excludeCategoryChilds} onChange={(e) => setExcludeCategoryChilds(e.target.checked)} />
									<span>{t('discount.excludingSubCategories')}</span>
								</label>

								<IdChips
									label={t('discount.zones')} hint={t('discount.zonesHint')}
									ids={zoneIds} onChange={setZoneIds}
									searchTitle={t('discount.zones')} searchPlaceholder={t('product.searchZones')} minChars={1}
									search={(q) => client!.getZones({ search: q }).then((z) => z.map((x) => ({ id: x.id, label: x.name, sub: x.type })))}
									resolve={(ids) => client!.getZones({ ids }).then((z) => z.map((x) => ({ id: x.id, label: x.name })))}
								/>
								<IdChips
									label={t('discount.customers')} hint={t('discount.customersHint')}
									ids={userIds} onChange={setUserIds}
									searchTitle={t('discount.customers')} searchPlaceholder={t('product.searchUsers')} minChars={2}
									search={(q) => client!.getUsers({ search: q }).then((u) => u.map((x) => ({ id: x.id, label: x.name || x.email, sub: x.name ? x.email : undefined })))}
									resolve={(ids) => client!.getUsers({ ids }).then((u) => u.map((x) => ({ id: x.id, label: x.name || x.email })))}
								/>

								<AccessField label={t('discount.access')} hint={t('discount.accessHint')} value={access} onChange={setAccess} />
								<AccessField label={t('discount.excludeAccess')} hint={t('discount.excludeAccessHint')} value={excludeAccess} onChange={setExcludeAccess} />
							</>
						)}
					</div>

					<div className="hk-card hk-card--pad hk-form">
						{err && <div className="hk-error-note">{err}</div>}
						{editing && (
							<DeleteButton block disabled={busy} label={t('discount.delete')}
								confirmMessage={t('discount.confirmDelete')} onConfirm={() => void remove()} />
						)}
					</div>
				</>
			)}
		</Screen>
	);
}
