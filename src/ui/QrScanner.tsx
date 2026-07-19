import { useEffect, useRef, useState } from 'react';

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

export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const onResultRef = useRef(onResult);
	onResultRef.current = onResult;
	const [error, setError] = useState('');

	useEffect(() => {
		const Ctor = detectorCtor();
		if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
			setError('Scanning is not supported on this device.');
			return;
		}
		let stream: MediaStream | null = null;
		let raf = 0;
		let stopped = false;
		const detector = new Ctor({ formats: ['qr_code'] });

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
				setError(
					e instanceof DOMException && e.name === 'NotAllowedError'
						? 'Camera permission was denied.'
						: 'Could not start the camera.',
				);
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
			{error ? (
				<div className="hk-error-note">{error}</div>
			) : (
				<p className="hk-muted hk-scan-hint">Point the camera at the pairing QR code in your backend.</p>
			)}
			<button className="hk-btn hk-btn--block" onClick={onClose}>Cancel</button>
		</div>
	);
}
