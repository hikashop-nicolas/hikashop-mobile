// HikaShop stores price_value tax-exclusive; the editor can enter either the excl-tax
// or incl-tax amount and convert via the product's tax rate (e.g. 0.06 for 6%).
export function inclFromExcl(excl: number, rate: number): number {
	return round2(excl * (1 + (rate || 0)));
}

export function exclFromIncl(incl: number, rate: number): number {
	return round2(incl / (1 + (rate || 0)));
}

function round2(n: number): number {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}
