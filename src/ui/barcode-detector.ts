// Picks a BarcodeDetector: the browser's own when it reads every format asked for (Chromium on
// Android and macOS), else the zxing-wasm ponyfill, loaded only then (Safari, iOS, Firefox, Windows).

export interface DetectedBarcode {
	rawValue: string;
}
export interface BarcodeDetectorLike {
	detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
export interface BarcodeDetectorCtor {
	new (opts?: { formats?: string[] }): BarcodeDetectorLike;
	getSupportedFormats?: () => Promise<string[]>;
}

function nativeCtor(): BarcodeDetectorCtor | null {
	if (typeof window === 'undefined') return null;
	return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

// True when a scan can run at all: a camera API, plus either native detection or WebAssembly.
export function canDetectBarcodes(): boolean {
	if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
	return !!nativeCtor() || typeof WebAssembly === 'object';
}

export async function nativeCovers(Ctor: BarcodeDetectorCtor, formats: string[]): Promise<boolean> {
	if (!Ctor.getSupportedFormats) return false;
	try {
		const have = await Ctor.getSupportedFormats();
		return formats.every((f) => have.includes(f));
	} catch {
		return false;
	}
}

let ponyfill: Promise<BarcodeDetectorCtor> | null = null;

function loadPonyfill(): Promise<BarcodeDetectorCtor> {
	ponyfill ??= (async () => {
		const [mod, wasm] = await Promise.all([
			import('barcode-detector/ponyfill'),
			import('zxing-wasm/reader/zxing_reader.wasm?url'),
		]);
		// Served from the app itself, never the library's CDN default: works offline and in the shell.
		mod.prepareZXingModule({
			overrides: {
				locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasm.default : prefix + path),
			},
		});
		return mod.BarcodeDetector as unknown as BarcodeDetectorCtor;
	})();
	ponyfill.catch(() => { ponyfill = null; });
	return ponyfill;
}

export async function getDetectorCtor(formats: string[]): Promise<BarcodeDetectorCtor> {
	const native = nativeCtor();
	if (native && await nativeCovers(native, formats)) return native;
	return loadPonyfill();
}
