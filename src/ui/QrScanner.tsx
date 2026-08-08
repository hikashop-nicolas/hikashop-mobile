import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Button } from './atoms';

// Pure-web QR scanner: BarcodeDetector over a getUserMedia stream. Works in the PWA and in the
// Capacitor Android WebView (Chromium), so no native plugin is needed. Callers must only mount
// it when isQrScanSupported() is true; it still degrades to an error message if the camera fails.

interface DetectedBarcode {
	rawValue: string;
}
interface BarcodeDetectorLike {
	detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorCtor {
	new (opts?: { formats?: string[] }): BarcodeDetectorLike;
}

function detectorCtor(): BarcodeDetectorCtor | null {
	return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

export function isQrScanSupported(): boolean {
	return !!detectorCtor() && !!navigator.mediaDevices?.getUserMedia;
}

// The retail barcode symbologies worth scanning, plus qr_code for device pairing. The caller
// picks: pairing wants qr_code only, stock lookup wants the product barcodes.
export const QR_FORMATS = ['qr_code'];
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'];

export function QrScanner({ onResult, onClose, formats = QR_FORMATS, title }: {
	onResult: (text: string) => void;
	onClose: () => void;
	formats?: string[];
	title?: string;
}) {
	const t = useT();
	const videoRef = useRef<HTMLVideoElement>(null);
	const onResultRef = useRef(onResult);
	onResultRef.current = onResult;
	// Fixed for the life of a scan session, so the camera effect need not restart on a re-render.
	const formatsRef = useRef(formats);
	const [errorKey, setErrorKey] = useState('');

	useEffect(() => {
		const Ctor = detectorCtor();
		if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
			setErrorKey('scan.unsupported');
			return;
		}
		let stream: MediaStream | null = null;
		let raf = 0;
		let stopped = false;
		const detector = new Ctor({ formats: formatsRef.current });

		const stop = () => {
			stopped = true;
			if (raf) cancelAnimationFrame(raf);
			stream?.getTracks().forEach((t) => t.stop());
		};

		void (async () => {
			try {
				stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
				if (stopped) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}
				const v = videoRef.current;
				if (!v) return;
				v.srcObject = stream;
				await v.play().catch(() => {});
				const tick = async () => {
					if (stopped || !videoRef.current) return;
					try {
						const codes = await detector.detect(videoRef.current);
						const hit = codes.find((c) => c.rawValue);
						if (hit) {
							stop();
							onResultRef.current(hit.rawValue);
							return;
						}
					} catch {
						// transient decode error while a frame is not ready; keep scanning
					}
					raf = requestAnimationFrame(tick);
				};
				raf = requestAnimationFrame(tick);
			} catch (e) {
				setErrorKey(e instanceof DOMException && e.name === 'NotAllowedError' ? 'scan.denied' : 'scan.failed');
			}
		})();

		return stop;
	}, []);

	return (
		<div className="hk-scan">
			<div className="hk-scan-stage">
				<video ref={videoRef} className="hk-scan-video" playsInline muted />
				<div className="hk-scan-reticle" aria-hidden="true" />
			</div>
			{errorKey ? (
				<div className="hk-error-note">{t(errorKey)}</div>
			) : (
				<p className="hk-muted hk-scan-hint">{title ?? t('scan.hint')}</p>
			)}
			<Button block onClick={onClose}>{t('common.cancel')}</Button>
		</div>
	);
}
