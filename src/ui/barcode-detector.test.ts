import { describe, it, expect } from 'vitest';
import { nativeCovers } from './barcode-detector';
import type { BarcodeDetectorCtor } from './barcode-detector';

const ctor = (formats: string[] | null): BarcodeDetectorCtor => {
	const C = function () { return { detect: async () => [] }; } as unknown as BarcodeDetectorCtor;
	if (formats) C.getSupportedFormats = async () => formats;
	return C;
};

describe('nativeCovers', () => {
	it('uses the native detector only when it reads every requested format', async () => {
		expect(await nativeCovers(ctor(['qr_code', 'ean_13']), ['qr_code'])).toBe(true);
		expect(await nativeCovers(ctor(['qr_code']), ['qr_code', 'ean_13'])).toBe(false);
	});

	it('falls back when the browser cannot list its formats', async () => {
		expect(await nativeCovers(ctor(null), ['qr_code'])).toBe(false);
	});
});
