import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { Screen, Button } from '../ui';
import { hostOf } from '../app/utils';

export function Stores() {
	const { stores, active, setActive, remove, notifyEnabled, notifySupported, enableNotifications, disableNotifications } = useStores();
	const nav = useNavigate();
	const [notifyErr, setNotifyErr] = useState('');

	async function toggleNotifications() {
		setNotifyErr('');
		if (notifyEnabled) {
			disableNotifications();
			return;
		}
		const granted = await enableNotifications();
		if (!granted) setNotifyErr('Notifications are blocked. Allow them in your device settings, then try again.');
	}

	return (
		<Screen title="Your stores">
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
						{active?.id === s.id && <span className="hk-status hk-status--ok">Active</span>}
						<button
							className="hk-btn hk-btn--danger"
							style={{ minHeight: '32px', padding: '0 10px' }}
							onClick={() => { if (window.confirm(`Remove ${s.name}?`)) void remove(s.id); }}
						>
							Remove
						</button>
					</div>
				</div>
			))}
			<Button block onClick={() => nav('/connect')}>＋ Add another store</Button>

			{notifySupported && (
				<div className="hk-card hk-card--pad" style={{ marginTop: 'var(--hk-s4)' }}>
					<div className="hk-row" style={{ borderBottom: 'none', padding: 0 }}>
						<div className="hk-row-grow">
							<span className="hk-row-title">Order notifications</span>
							<span className="hk-row-sub">Alert this device when a new order comes in.</span>
						</div>
						<button
							className={`hk-btn${notifyEnabled ? '' : ' hk-btn--pri'}`}
							style={{ minHeight: '36px', padding: '0 14px' }}
							onClick={() => void toggleNotifications()}
						>
							{notifyEnabled ? 'On' : 'Enable'}
						</button>
					</div>
					{notifyErr && <div className="hk-error-note" style={{ marginTop: 'var(--hk-s3)' }}>{notifyErr}</div>}
				</div>
			)}
		</Screen>
	);
}
