import { useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useT } from '../i18n';
import { clampThreshold } from '../core';
import { Screen, Field, Button, Icon } from '../ui';
import { playChime, primeAudio } from '../app/chime';

// Alerting preferences: which events raise a notification, the low-stock threshold and the
// sound. Permission is requested here too, since that is what actually enables delivery.
export function Notifications() {
	const nav = useNavigate();
	const t = useT();
	const {
		notifyEnabled, notifySupported, enableNotifications, disableNotifications,
		notifySettings: s, setNotifySettings,
	} = useStores();

	async function togglePermission() {
		if (notifyEnabled) { disableNotifications(); return; }
		// Enabling happens inside a tap, which is also the only moment browsers let us unlock audio.
		await primeAudio();
		await enableNotifications();
	}

	return (
		<Screen
			title={t('notifications.title')}
			left={<button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
		>
			<div className="hk-card hk-card--pad hk-form">
				<div className="hk-row">
					<div className="hk-row-grow">
						<span className="hk-row-title">{t('notifications.enable')}</span>
						<span className="hk-row-sub">
							{!notifySupported
								? t('notifications.unsupported')
								: notifyEnabled ? t('notifications.on') : t('notifications.off')}
						</span>
					</div>
					<Button variant={notifyEnabled ? 'default' : 'pri'} size="sm" disabled={!notifySupported} onClick={() => void togglePermission()}>
						{notifyEnabled ? t('notifications.turnOff') : t('notifications.turnOn')}
					</Button>
				</div>
			</div>

			<div className="hk-card hk-card--pad hk-form">
				<div className="hk-card-head"><span className="hk-muted hk-row-grow">{t('notifications.alertMe')}</span></div>

				<label className="hk-check">
					<input type="checkbox" checked={s.newOrders} onChange={(e) => setNotifySettings({ ...s, newOrders: e.target.checked })} />
					<span>{t('notifications.newOrders')}</span>
				</label>

				<label className="hk-check">
					<input type="checkbox" checked={s.lowStock} onChange={(e) => setNotifySettings({ ...s, lowStock: e.target.checked })} />
					<span>{t('notifications.lowStock')}</span>
				</label>

				{s.lowStock && (
					<Field label={t('notifications.threshold')} hint={t('notifications.thresholdHint')}>
						<input className="hk-input" type="number" inputMode="numeric" min="0" max="999"
							value={String(s.lowStockThreshold)}
							onChange={(e) => setNotifySettings({ ...s, lowStockThreshold: clampThreshold(Number(e.target.value)) })} />
					</Field>
				)}
			</div>

			<div className="hk-card hk-card--pad hk-form">
				<div className="hk-card-head"><span className="hk-muted hk-row-grow">{t('notifications.sound')}</span></div>
				<label className="hk-check">
					<input type="checkbox" checked={s.sound} onChange={(e) => { setNotifySettings({ ...s, sound: e.target.checked }); if (e.target.checked) void playChime(); }} />
					<span>{t('notifications.playSound')}</span>
				</label>
				{/* alignSelf keeps it button-sized: hk-form is a column flex, which stretches children. */}
				<Button size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => void playChime()}>{t('notifications.testSound')}</Button>
				<span className="hk-row-sub">{t('notifications.foregroundOnly')}</span>
			</div>
		</Screen>
	);
}
