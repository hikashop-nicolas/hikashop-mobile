import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Currency } from '../core';

// Format a number as a price, faithful to a HikaShop currency's settings
// (decimals, decimal/thousands separators, symbol position and spacing).
export function formatMoney(value: number, currency?: Currency | null): string {
	const decimals = currency?.decimals ?? 2;
	const dsep = currency?.decimal_sep ?? '.';
	const tsep = currency?.thousands_sep ?? ',';
	const n = Number.isFinite(value) ? value : 0;
	const fixed = Math.abs(n).toFixed(decimals);
	const [intPart, fracPart] = fixed.split('.');
	const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, tsep || '');
	let num = fracPart ? `${grouped}${dsep}${fracPart}` : grouped;
	if (n < 0) num = `-${num}`;
	const sym = currency?.symbol ?? '';
	if (!sym) return num;
	const space = currency?.space ? ' ' : '';
	return currency?.symbol_before === false ? `${num}${space}${sym}` : `${sym}${space}${num}`;
}

// Currencies keyed by id, provided from the active store's meta.
const CurrencyContext = createContext<Map<number, Currency>>(new Map());

export function CurrencyProvider({ currencies, children }: { currencies: Currency[]; children: ReactNode }) {
	const map = new Map<number, Currency>(currencies.map((c) => [c.id, c]));
	return <CurrencyContext.Provider value={map}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(id?: number): Currency | undefined {
	const map = useContext(CurrencyContext);
	return id != null ? map.get(id) : undefined;
}

// Price atom: renders a value in the given currency using the shop's format.
export function Money({ value, currency }: { value: number; currency?: number }) {
	const cur = useCurrency(currency);
	return <span className="hk-money">{formatMoney(value, cur)}</span>;
}
