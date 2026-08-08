import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { Discount, DiscountInput, DiscountType } from '../core';
import { Screen, Spinner, Field, Button, Icon } from '../ui';
import { validateDiscount } from '../app/discounts';

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
	const [minOrder, setMinOrder] = useState('');
	const [quota, setQuota] = useState('');
	const [perUser, setPerUser] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const [confirmDelete, setConfirmDelete] = useState(false);

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
				setMinOrder(d.minimum_order ? String(d.minimum_order) : '');
				setQuota(d.quota ? String(d.quota) : '');
				setPerUser(d.quota_per_user ? String(d.quota_per_user) : '');
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
			minimum_order: minOrder ? Number(minOrder.replace(',', '.')) : 0,
			quota: quota ? parseInt(quota, 10) : 0,
			quota_per_user: perUser ? parseInt(perUser, 10) : 0,
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
		setConfirmDelete(false);
		setBusy(true);
		try {
			await client.deleteDiscount(Number(id));
			nav('/discounts');
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	return (
		<Screen
			title={editing ? code || t('discount.edit') : t('discounts.newDiscount')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={<Button variant="pri" size="sm" disabled={busy || !loaded} onClick={() => void save()}>{busy ? t('product.saving') : t('common.save')}</Button>}
		>
			{!loaded ? (
				<div className="hk-center-col"><Spinner /></div>
			) : (
				<div className="hk-card hk-card--pad hk-form">
					<Field label={t('discount.promotionType')} hint={type === 'coupon' ? t('discount.couponHint') : t('discount.autoHint')}>
						<div className="hk-segmented">
							<button type="button" className={`hk-seg${type === 'coupon' ? ' hk-on' : ''}`} onClick={() => setType('coupon')}>{t('discount.typeCoupon')}</button>
							<button type="button" className={`hk-seg${type === 'discount' ? ' hk-on' : ''}`} onClick={() => setType('discount')}>{t('discount.typeAuto')}</button>
						</div>
					</Field>
					{type === 'coupon' && (
						<Field label={t('discount.code')}>
							<input className="hk-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" autoCorrect="off" />
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
					<Field label={t('discount.minimumOrder')}>
						<input className="hk-input" type="number" inputMode="decimal" min="0" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
					</Field>
					<div className="hk-form-row">
						<Field label={t('discount.quota')} hint={t('discount.quotaHint')}>
							<input className="hk-input" type="number" inputMode="numeric" min="0" value={quota} onChange={(e) => setQuota(e.target.value)} />
						</Field>
						<Field label={t('discount.quotaPerUser')} hint={t('discount.quotaHint')}>
							<input className="hk-input" type="number" inputMode="numeric" min="0" value={perUser} onChange={(e) => setPerUser(e.target.value)} />
						</Field>
					</div>

					{err && <div className="hk-error-note">{err}</div>}
					{editing && (confirmDelete ? (
						<div className="hk-card hk-card--pad" style={{ display: 'grid', gap: 'var(--hk-s2)' }}>
							<span className="hk-row-sub">{t('discount.confirmDelete')}</span>
							<div style={{ display: 'flex', gap: 'var(--hk-s2)' }}>
								<Button variant="danger" disabled={busy} onClick={() => void remove()}>{t('common.delete')}</Button>
								<Button disabled={busy} onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
							</div>
						</div>
					) : (
						<Button variant="danger" block disabled={busy} onClick={() => setConfirmDelete(true)}>
							<Icon name="trash" size={16} /> {t('discount.delete')}
						</Button>
					))}
				</div>
			)}
		</Screen>
	);
}
