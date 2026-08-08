import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiClient } from '../core';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import { Screen, Button, Field, QrScanner, isQrScanSupported, Icon } from '../ui';
import { normalizeUrl, hostOf, deviceName } from '../app/utils';
import { parsePairingPayload } from '../app/pairing';

export function Connect() {
	const { registry, refresh, stores } = useStores();
	const nav = useNavigate();
	const t = useT();
	const [url, setUrl] = useState('');
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const [scanning, setScanning] = useState(false);
	const scanSupported = isQrScanSupported();

	async function doPair(rawUrl: string, rawCode: string) {
		setErr('');
		const base = normalizeUrl(rawUrl);
		if (!base) return setErr(t('connect.errNoUrl'));
		if (!rawCode.trim()) return setErr(t('connect.errNoCode'));
		setBusy(true);
		try {
			const res = await ApiClient.pair(base, rawCode, deviceName(), 'pwa');
			const site = await new ApiClient(base, res.token).getSite();
			await registry.add(
				// The shop's own name where it has one; its address is the fallback and stays on
				// show in the store list either way.
				{ name: site.site_name?.trim() || hostOf(base), baseUrl: base, role: site.operator?.role ?? 'staff', logo: site.logo ?? '', capabilities: site.capabilities, permissions: site.permissions },
				res.token,
			);
			await refresh();
			nav('/dashboard');
		} catch (e) {
			const codeStr = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : '';
			setErr(codeStr ? tError(t, codeStr) : t('connect.errFailed'));
		} finally {
			setBusy(false);
		}
	}

	function handleScan(text: string) {
		setScanning(false);
		const hint = parsePairingPayload(text);
		if (!hint) return setErr(t('connect.errQr'));
		const nextUrl = hint.url ?? url;
		const nextCode = hint.code ?? code;
		setUrl(nextUrl);
		setCode(nextCode);
		// A full payload (URL + code) pairs straight away; a partial one just fills the form.
		if (hint.url && hint.code) void doPair(nextUrl, nextCode);
	}

	// The intro keeps the backend location in bold: split the template on its {location} slot.
	const [introBefore, introAfter] = t('connect.intro').split('{location}');

	const canGoBack = stores.length > 0;
	return (
		<Screen
			title={t('connect.title')}
			left={canGoBack ? <button className="hk-iconbtn" onClick={() => nav(-1)} aria-label={t('common.back')}><Icon name="back" size={24} /></button> : undefined}
		>
			{scanning ? (
				<QrScanner onResult={handleScan} onClose={() => setScanning(false)} />
			) : (
				<>
					<p className="hk-muted">
						{introBefore}<b>{t('connect.location')}</b>{introAfter}
					</p>
					{scanSupported && (
						<Button variant="pri" block disabled={busy} onClick={() => { setErr(''); setScanning(true); }}>
							<Icon name="scan" size={18} /> {t('connect.scan')}
						</Button>
					)}
					<Field label={t('connect.storeAddress')}>
						<input className="hk-input" placeholder="https://myshop.com" value={url}
							onChange={(e) => setUrl(e.target.value)} autoCapitalize="off" autoCorrect="off" inputMode="url" />
					</Field>
					<Field label={t('connect.pairingCode')} hint={t('connect.codeHint')}>
						<input className="hk-input" placeholder="K7P-4M2-9RX" value={code}
							onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" />
					</Field>
					{err && <div className="hk-error-note">{err}</div>}
					<Button variant={scanSupported ? 'default' : 'pri'} block disabled={busy} onClick={() => doPair(url, code)}>
						<Icon name="check" size={18} /> {busy ? t('connect.pairing') : t('connect.pair')}
					</Button>
				</>
			)}
		</Screen>
	);
}
