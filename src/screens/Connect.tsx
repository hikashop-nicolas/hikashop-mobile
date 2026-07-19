import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClient } from '../core';
import { useStores } from '../app/store-context';
import { Screen, Button, Field } from '../ui';
import { normalizeUrl, hostOf, deviceName } from '../app/utils';

export function Connect() {
	const { registry, refresh, stores } = useStores();
	const nav = useNavigate();
	const [url, setUrl] = useState('');
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	async function pair() {
		setErr('');
		const base = normalizeUrl(url);
		if (!base) return setErr('Enter your store address.');
		if (!code.trim()) return setErr('Enter the pairing code.');
		setBusy(true);
		try {
			const res = await ApiClient.pair(base, code, deviceName(), 'pwa');
			const site = await new ApiClient(base, res.token).getSite();
			await registry.add(
				{ name: hostOf(base), baseUrl: base, role: site.operator?.role ?? 'staff', capabilities: site.capabilities },
				res.token,
			);
			await refresh();
			nav('/dashboard');
		} catch (e) {
			setErr(e instanceof Error ? e.message : 'Pairing failed.');
		} finally {
			setBusy(false);
		}
	}

	const canGoBack = stores.length > 0;
	return (
		<Screen
			title="Connect a store"
			left={canGoBack ? <button className="hk-iconbtn" onClick={() => nav(-1)} aria-label="Back">‹</button> : undefined}
		>
			<p className="hk-muted">
				Pair this device with your HikaShop store. Generate a code in your backend under <b>System › App Devices</b>,
				then enter your store address and the code below.
			</p>
			<Field label="Store address">
				<input className="hk-input" placeholder="https://myshop.com" value={url}
					onChange={(e) => setUrl(e.target.value)} autoCapitalize="off" autoCorrect="off" inputMode="url" />
			</Field>
			<Field label="Pairing code" hint="Shown with the QR code in your backend.">
				<input className="hk-input" placeholder="K7P-4M2-9RX" value={code}
					onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
			</Field>
			{err && <div className="hk-error-note">{err}</div>}
			<Button variant="pri" block disabled={busy} onClick={pair}>{busy ? 'Pairing…' : 'Pair device'}</Button>
		</Screen>
	);
}
