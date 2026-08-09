import { useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useI18n, LOCALES } from '../i18n';
import { Screen, Button, Icon, DeleteButton, StoreLogo } from '../ui';
import { hostOf } from '../app/utils';
import { appBuild } from '../app/register-sw';
import { useTheme } from '../app/theme';
import type { ThemeChoice } from '../app/theme';

export function Stores() {
	const { stores, active, setActive, remove, notifyEnabled, notifySupported } = useStores();
	const { t, locale, setLocale } = useI18n();
	const { theme, setTheme } = useTheme();
	const nav = useNavigate();

	return (
		<Screen title={t('stores.title')}>
			{stores.map((s) => (
				<div key={s.id} className="hk-row">
					<StoreLogo src={s.logo} className="hk-logo-avatar"
						fallback={<div className="hk-avatar">{s.name.charAt(0).toUpperCase()}</div>} />
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
						<DeleteButton size="sm" label={t('stores.remove')}
							confirmMessage={t('stores.removeConfirm', { name: s.name })}
							onConfirm={() => void remove(s.id)} />
					</div>
				</div>
			))}
			<Button block onClick={() => nav('/connect')}><Icon name="plus" size={18} /> {t('stores.add')}</Button>

			{notifySupported && (
				<div className="hk-card hk-card--pad" style={{ marginTop: 'var(--hk-s4)' }}>
					<button type="button" className="hk-row hk-row--btn" style={{ borderBottom: 'none', padding: 0, width: '100%' }} onClick={() => nav('/notifications')}>
						<span className="hk-lead-ic"><Icon name="bell" size={20} /></span>
						<div className="hk-row-grow">
							<span className="hk-row-title">{t('notifications.title')}</span>
							<span className="hk-row-sub">{notifyEnabled ? t('notifications.on') : t('notifications.off')}</span>
						</div>
						<Icon name="chevron" size={16} />
					</button>
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

				<div className="hk-row" style={{ borderBottom: 'none', padding: 'var(--hk-s3) 0 0' }}>
					<span className="hk-lead-ic"><Icon name="dashboard" size={20} /></span>
					<div className="hk-row-grow">
						<span className="hk-row-title">{t('stores.appearance')}</span>
					</div>
					<select className="hk-select" value={theme} onChange={(e) => setTheme(e.target.value as ThemeChoice)}>
						<option value="auto">{t('stores.themeAuto')}</option>
						<option value="light">{t('stores.themeLight')}</option>
						<option value="dark">{t('stores.themeDark')}</option>
					</select>
				</div>

				{/* Which build is running. An installed app can go a long time without being closed,
				    so "did you get the fix?" is otherwise unanswerable. */}
				<div className="hk-row" style={{ borderBottom: 'none', padding: 'var(--hk-s3) 0 0' }}>
					<span className="hk-lead-ic"><Icon name="check" size={20} /></span>
					<div className="hk-row-grow">
						<span className="hk-row-title">{t('stores.build')}</span>
						<span className="hk-row-sub">{appBuild()}</span>
					</div>
				</div>
			</div>
		</Screen>
	);
}
