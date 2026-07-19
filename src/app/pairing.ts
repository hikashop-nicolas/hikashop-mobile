// Parse a scanned QR (or pasted string) into a store URL and/or pairing code. The connector
// encodes JSON {"url","code"}; a bare URL or a bare code is also accepted for resilience.

export interface PairingHint {
	url?: string;
	code?: string;
}

export function parsePairingPayload(text: string): PairingHint | null {
	const s = (text || '').trim();
	if (!s) return null;

	// JSON payload from the connector's QR code.
	if (s.startsWith('{')) {
		try {
			const o = JSON.parse(s) as Record<string, unknown>;
			const hint: PairingHint = {};
			if (typeof o.url === 'string' && o.url.trim()) hint.url = o.url.trim();
			if (typeof o.code === 'string' && o.code.trim()) hint.code = o.code.trim();
			return hint.url || hint.code ? hint : null;
		} catch {
			return null;
		}
	}

	// A bare store URL.
	if (/^https?:\/\//i.test(s)) return { url: s };

	// Otherwise treat the whole string as a pairing code.
	return { code: s };
}
