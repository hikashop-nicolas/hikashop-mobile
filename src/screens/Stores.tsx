import { useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { Screen, Button } from '../ui';
import { hostOf } from '../app/utils';

export function Stores() {
	const { stores, active, setActive, remove } = useStores();
	const nav = useNavigate();

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
		</Screen>
	);
}
