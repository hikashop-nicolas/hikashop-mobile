import type { ProductField } from '../core';

// The custom fields a merchant ticked for the app's listings, rendered as one compact line under
// the row. Only fields with a value appear, so a row never shows an empty label, and the caller
// decides nothing: if the merchant ticked none, this renders nothing at all.
export function ListingFields({ fields, values }: {
	fields?: ProductField[];
	values?: Record<string, string>;
}) {
	if (!fields?.length || !values) return null;

	const shown = fields
		.map((f) => ({ label: f.label, value: (values[f.namekey] ?? '').trim() }))
		.filter((x) => x.value !== '');
	if (shown.length === 0) return null;

	return (
		<span className="hk-row-sub hk-row-fields">
			{shown.map((x) => (
				<span key={x.label} className="hk-row-field">
					<span className="hk-row-field-label">{x.label}</span> {x.value}
				</span>
			))}
		</span>
	);
}
