import { describe, it, expect } from 'vitest';
import { parsePairingPayload } from './pairing';

describe('parsePairingPayload', () => {
	it('parses the connector JSON payload', () => {
		expect(parsePairingPayload('{"url":"https://shop.example","code":"K7P-4M2-9RX"}'))
			.toEqual({ url: 'https://shop.example', code: 'K7P-4M2-9RX' });
	});

	it('keeps only the fields present in the JSON', () => {
		expect(parsePairingPayload('{"code":"K7P-4M2-9RX"}')).toEqual({ code: 'K7P-4M2-9RX' });
		expect(parsePairingPayload('{"url":"https://shop.example"}')).toEqual({ url: 'https://shop.example' });
	});

	it('treats a bare URL as the store address', () => {
		expect(parsePairingPayload('https://shop.example/')).toEqual({ url: 'https://shop.example/' });
	});

	it('treats any other non-empty string as a bare code', () => {
		expect(parsePairingPayload('K7P-4M2-9RX')).toEqual({ code: 'K7P-4M2-9RX' });
	});

	it('returns null for empty, whitespace, or useless payloads', () => {
		expect(parsePairingPayload('')).toBeNull();
		expect(parsePairingPayload('   ')).toBeNull();
		expect(parsePairingPayload('{bad json')).toBeNull();
		expect(parsePairingPayload('{"other":"x"}')).toBeNull();
	});

	it('trims surrounding whitespace', () => {
		expect(parsePairingPayload('  K7P-4M2-9RX  ')).toEqual({ code: 'K7P-4M2-9RX' });
	});
});
