import { useEffect, useRef, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { BarcodeMatch } from '../core';
import { Modal, Field, Button, Spinner, QrScanner, BARCODE_FORMATS, isQrScanSupported } from '../ui';

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}

// Scan a product barcode (or type/wedge one in) and act on the match: open it, or set its stock
// without leaving the scanner. Hardware scanners present as a keyboard, so the text field is the
// HID path and needs no special handling beyond submitting on Enter.
export function ScanProductModal({ onClose, onOpen }: {
	onClose: () => void;
	onOpen: (productId: number) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [scanning, setScanning] = useState(isQrScanSupported());
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const [match, setMatch] = useState<BarcodeMatch | null>(null);
	const [stock, setStock] = useState('');
	const [saved, setSaved] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	// A keyboard-wedge scanner types into whatever has focus, so keep the field focused.
	useEffect(() => { if (!scanning && !match) inputRef.current?.focus(); }, [scanning, match]);

	async function resolve(barcode: string) {
		const value = barcode.trim();
		if (!client || !value || busy) return;
		setErr('');
		setBusy(true);
		try {
			const m = await client.lookupBarcode(value);
			setMatch(m);
			setStock(m.quantity >= 0 ? String(m.quantity) : '');
			setScanning(false);
		} catch (e) {
			const c = codeOf(e);
			setErr(c === 'not_found' ? t('scan.noMatch', { code: value }) : tError(t, c));
			setCode('');
			// Stay on the scanner so the next item can just be scanned.
		} finally {
			setBusy(false);
		}
	}

	async function saveStock() {
		if (!client || !match || busy) return;
		setBusy(true);
		setErr('');
		try {
			const q = stock.trim() === '' ? -1 : parseInt(stock, 10) || 0;
			const res = await client.setProductStock(match.id, q);
			setMatch({ ...match, quantity: res.quantity });
			setSaved(true);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
		} finally {
			setBusy(false);
		}
	}

	function scanAnother() {
		setMatch(null);
		setCode('');
		setSaved(false);
		setErr('');
		setScanning(isQrScanSupported());
	}

	return (
		<Modal title={t('scan.productTitle')} onClose={onClose}>
			{scanning ? (
				<QrScanner
					formats={BARCODE_FORMATS}
					title={t('scan.productHint')}
					onResult={(text) => void resolve(text)}
					onClose={() => setScanning(false)}
				/>
			) : match ? (
				<div className="hk-form">
					<div>
						<div className="hk-row-title">{match.name}</div>
						<div className="hk-row-sub">{match.code}{match.gtin ? ` · ${match.gtin}` : ''}</div>
					</div>
					<Field label={t('product.stock')} hint={t('product.setUnlimited')}>
						<input ref={inputRef} className="hk-input" type="number" inputMode="numeric"
							value={stock} onChange={(e) => { setStock(e.target.value); setSaved(false); }} />
					</Field>
					{err && <div className="hk-error-note">{err}</div>}
					<Button variant="pri" block disabled={busy} onClick={() => void saveStock()}>
						{busy ? t('product.saving') : saved ? t('product.saved') : t('product.updateStock')}
					</Button>
					<Button block onClick={() => onOpen(match.id)}>{t('scan.openProduct')}</Button>
					<Button block onClick={scanAnother}>{t('scan.scanAnother')}</Button>
				</div>
			) : (
				<div className="hk-form">
					{/* Typed or wedge-scanned entry, and the fallback when there is no camera. */}
					<Field label={t('scan.enterBarcode')} hint={t('scan.enterHint')}>
						<input ref={inputRef} className="hk-input" value={code} autoCapitalize="off" autoCorrect="off"
							onChange={(e) => setCode(e.target.value)}
							onKeyDown={(e) => { if (e.key === 'Enter') void resolve(code); }} />
					</Field>
					{busy && <div className="hk-center-col"><Spinner /></div>}
					{err && <div className="hk-error-note">{err}</div>}
					<Button variant="pri" block disabled={busy || !code.trim()} onClick={() => void resolve(code)}>
						{t('scan.find')}
					</Button>
					{isQrScanSupported() && (
						<Button block onClick={() => { setErr(''); setScanning(true); }}>{t('scan.useCamera')}</Button>
					)}
				</div>
			)}
		</Modal>
	);
}
