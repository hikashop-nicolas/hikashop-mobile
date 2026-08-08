import type { ReactNode } from 'react';
import type { FormattedAddress } from '../core';

// An address the connector may have rendered for us.
interface Addressish {
	street?: string;
	city?: string;
	post_code?: string;
	formatted?: FormattedAddress;
}

// Fall back to a plain assembly only when the shop has emptied its address format, so an address
// still shows something rather than nothing.
function fallback(a: Addressish): string {
	return [a.street, [a.post_code, a.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

// The full block, as the shop's format lays it out. Rendered as lines rather than one string
// because the format is line-based and the order of those lines is the point.
export function addressLines(a: Addressish): ReactNode {
	const text = a.formatted?.text?.trim();
	if (!text) return fallback(a);
	return text.split(/\r\n|\r|\n/).map((line, i) => <div key={i}>{line}</div>);
}

// The condensed form, for list rows.
export function addressOneLine(a: Addressish): string {
	return a.formatted?.one_line?.trim() || fallback(a);
}
