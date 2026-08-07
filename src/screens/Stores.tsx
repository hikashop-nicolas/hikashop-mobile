import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useI18n, LOCALES } from '../i18n';
import { Screen, Button, Icon } from '../ui';
import { hostOf } from '../app/utils';

export function Stores() {
	const { stores, active, setActive, remove, notifyEnabled, notifySupported, enableNotifications, disableNotifications } = useStores();
	const { t, locale, setLocale } = useI18n();
	const nav = useNavigate();
	const [notifyErr, setNotifyErr] = useState('');

	async function toggleNotifications() {
		setNotifyErr('');
		if (notifyEnabled) {
			disableNotifications();
			return;
		}
		const granted = await enableNotifications();
		if (!granted) setNotifyErr(t('stores.notifBlocked'));
	}

	return (
		<Screen title={t('stores.title')}>
			{stores.map((s) => (
				<div key={s.id} className="hk-row">
					<div className="hk-avatar">{s.name.charAt(0).toUpperCase()}</div>
					<div
						className="hk-row-grow"
						style={{ cursor: 'pointer' }}
						onClick={() => { void setActive(s.id).then(() => nav('/dashboard')); }}
					>
						<span className="hk-row-title">{s.name}</span>
						<span className="hk-row-sub">{hostOf(s.baseUrl)} · {s.role}</span>
					</div>
					<div className="hk-row-rt">
						{active?.id === s.id && <span className="hk-status hk-status--ok">{t('stores.active')}</span>}
						<Button
							variant="danger"
							size="sm"
							onClick={() => { if (window.confirm(t('stores.removeConfirm', { name: s.name }))) void remove(s.id); }}
						>
							{t('stores.remove')}
						</Button>
					</div>
				</div>
			))}
			<Button block onClick={() => nav('/connect')}><Icon name="plus" size={18} /> {t('stores.add')}</Button>

			{notifySupported && (
				<div className="hk-card hk-card--pad" style={{ marginTop: 'var(--hk-s4)' }}>
					<div className="hk-row" style={{ borderBottom: 'none', padding: 0 }}>
						<span className="hk-lead-ic"><Icon name="bell" size={20} /></span>
						<div className="hk-row-grow">
							<span className="hk-row-title">{t('stores.notifTitle')}</span>
							<span className="hk-row-sub">{t('stores.notifSub')}</span>
						</div>
						<button
							className={`hk-btn${notifyEnabled ? '' : ' hk-btn--pri'}`}
							style={{ minHeight: '36px', padding: '0 14px' }}
							onClick={() => void toggleNotifications()}
						>
							{notifyEnabled ? t('stores.notifOn') : t('stores.notifEnable')}
						</button>
					</div>
					{notifyErr && <div className="hk-error-note" style={{ marginTop: 'var(--hk-s3)' }}>{notifyErr}</div>}
				</div>
			)}

			<div className="hk-card hk-card--pad" style={{ marginTop: 'var(--hk-s4)' }}>
				<div className="hk-row" style={{ borderBottom: 'none', padding: 0 }}>
					<span className="hk-lead-ic"><Icon name="store" size={20} /></span>
					<div className="hk-row-grow">
						<span className="hk-row-title">{t('stores.language')}</span>
					</div>
					<select className="hk-select" value={locale} onChange={(e) => setLocale(e.target.value)}>
						{Object.entries(LOCALES).map(([code, def]) => (
							<option key={code} value={code}>{def.name}</option>
						))}
					</select>
				</div>
			</div>
		</Screen>
	);
}
