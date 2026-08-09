import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Currency } from '../core';

// Round to a cash increment, the way class.currency::roundByIncrement does: 0.05 for a
// currency with no 1 cent coin.
export function roundToIncrement(value: number, increment: number): number {
	if (!(increment > 0)) return value;
	const steps = 1 / increment;
	// PHP's round() goes half away from zero while Math.round goes half up, so they disagree
	// on a negative exactly on the boundary: -12.375 at 0.05 is -12.40 in the shop and would
	// be -12.35 here. Refunds are negative, so round the magnitude and put the sign back.
	const r = Math.round(Math.abs(value) * steps) / steps;
	return value < 0 ? -r : r;
}

// Format a number as a price, faithful to a HikaShop currency's settings
// (decimals, decimal/thousands separators, symbol position and spacing, cash rounding).
//
// roundCalculations mirrors the shop's config: 1 means the increment was already applied
// while calculating, so applying it again here would be second-guessing the shop. Any other
// value means the shop applies it at display time, which is what this is.
export function formatMoney(value: number, currency?: Currency | null, roundCalculations = 0): string {
	const decimals = currency?.decimals ?? 2;
	const dsep = currency?.decimal_sep ?? '.';
	const tsep = currency?.thousands_sep ?? ',';
	let n = Number.isFinite(value) ? value : 0;
	if (roundCalculations !== 1 && currency?.rounding_increment)
		n = roundToIncrement(n, currency.rounding_increment);
	const negative = n < 0;
	const fixed = Math.abs(n).toFixed(Math.max(0, decimals));
	const [intPart, fracPart] = fixed.split('.');
	const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, tsep || '');
	const num = fracPart ? `${grouped}${dsep}${fracPart}` : grouped;
	const sym = currency?.symbol ?? '';
	const space = currency?.space ? ' ' : '';
	const body = !sym ? num : (currency?.symbol_before === false ? `${num}${space}${sym}` : `${sym}${space}${num}`);
	// Keep the sign outside the symbol so it reads -$5.00 / -1.234,50 €.
	return negative ? `-${body}` : body;
}

// Currencies keyed by id, plus the shop's rounding mode, from the active store.
type CurrencyScope = { map: Map<number, Currency>; roundCalculations: number };
const CurrencyContext = createContext<CurrencyScope>({ map: new Map(), roundCalculations: 0 });

export function CurrencyProvider(
	{ currencies, roundCalculations = 0, children }:
	{ currencies: Currency[]; roundCalculations?: number; children: ReactNode },
) {
	const map = new Map<number, Currency>(currencies.map((c) => [c.id, c]));
	return <CurrencyContext.Provider value={{ map, roundCalculations }}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(id?: number): Currency | undefined {
	const { map } = useContext(CurrencyContext);
	return id != null ? map.get(id) : undefined;
}

export function useRoundCalculations(): number {
	return useContext(CurrencyContext).roundCalculations;
}

// Price atom: renders a value in the given currency using the shop's format.
export function Money({ value, currency }: { value: number; currency?: number }) {
	const cur = useCurrency(currency);
	const mode = useRoundCalculations();
	return <span className="hk-money">{formatMoney(value, cur, mode)}</span>;
}
