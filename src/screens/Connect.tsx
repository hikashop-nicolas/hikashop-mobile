import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClient } from '../core';
import { useStores } from '../app/store-context';
import { Screen, Button, Field, QrScanner, isQrScanSupported } from '../ui';
import { normalizeUrl, hostOf, deviceName } from '../app/utils';
import { parsePairingPayload } from '../app/pairing';

export function Connect() {
	const { registry, refresh, stores } = useStores();
	const nav = useNavigate();
	const [url, setUrl] = useState('');
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const [scanning, setScanning] = useState(false);
	const scanSupported = isQrScanSupported();

	async function doPair(rawUrl: string, rawCode: string) {
		setErr('');
		const base = normalizeUrl(rawUrl);
		if (!base) return setErr('Enter your store address.');
		if (!rawCode.trim()) return setErr('Enter the pairing code.');
		setBusy(true);
		try {
			const res = await ApiClient.pair(base, rawCode, deviceName(), 'pwa');
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

	function handleScan(text: string) {
		setScanning(false);
		const hint = parsePairingPayload(text);
		if (!hint) return setErr('That QR code was not recognised.');
		const nextUrl = hint.url ?? url;
		const nextCode = hint.code ?? code;
		setUrl(nextUrl);
		setCode(nextCode);
		// A full payload (URL + code) pairs straight away; a partial one just fills the form.
		if (hint.url && hint.code) void doPair(nextUrl, nextCode);
	}

	const canGoBack = stores.length > 0;
	return (
		<Screen
			title="Connect a store"
			left={canGoBack ? <button className="hk-iconbtn" onClick={() => nav(-1)} aria-label="Back">‹</button> : undefined}
		>
			{scanning ? (
				<QrScanner onResult={handleScan} onClose={() => setScanning(false)} />
			) : (
				<>
					<p className="hk-muted">
						Pair this device with your HikaShop store. Generate a code in your backend under <b>System › App Devices</b>,
						then scan the QR code or enter your store address and the code below.
					</p>
					{scanSupported && (
						<Button variant="pri" block disabled={busy} onClick={() => { setErr(''); setScanning(true); }}>
							⛶ Scan QR code
						</Button>
					)}
					<Field label="Store address">
						<input className="hk-input" placeholder="https://myshop.com" value={url}
							onChange={(e) => setUrl(e.target.value)} autoCapitalize="off" autoCorrect="off" inputMode="url" />
					</Field>
					<Field label="Pairing code" hint="Shown with the QR code in your backend.">
						<input className="hk-input" placeholder="K7P-4M2-9RX" value={code}
							onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
					</Field>
					{err && <div className="hk-error-note">{err}</div>}
					<Button variant={scanSupported ? 'default' : 'pri'} block disabled={busy} onClick={() => doPair(url, code)}>
						{busy ? 'Pairing…' : 'Pair device'}
					</Button>
				</>
			)}
		</Screen>
	);
}
