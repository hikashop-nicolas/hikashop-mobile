import { describe, it, expect } from 'vitest';
import { normalizeUrl, hostOf } from './utils';

describe('normalizeUrl', () => {
	it('assumes https when no scheme is given', () => {
		expect(normalizeUrl('myshop.com')).toBe('https://myshop.com');
	});

	it('keeps the scheme it was given', () => {
		expect(normalizeUrl('http://localhost:8080/joomla6')).toBe('http://localhost:8080/joomla6');
	});

	it('drops trailing slashes and surrounding space', () => {
		expect(normalizeUrl('  https://myshop.com/shop//  ')).toBe('https://myshop.com/shop');
	});

	it('leaves an empty input empty', () => {
		expect(normalizeUrl('   ')).toBe('');
	});
});

describe('hostOf', () => {
	it('is just the host for a shop at the root of a domain', () => {
		expect(hostOf('https://myshop.com')).toBe('myshop.com');
		expect(hostOf('https://myshop.com/')).toBe('myshop.com');
	});

	it('keeps the port, which distinguishes two local shops', () => {
		expect(hostOf('http://localhost:8080')).toBe('localhost:8080');
	});

	// The reason this is not just the host: a staging copy beside the live shop, or two shops in
	// folders of one domain, would otherwise be named identically in the store list.
	it('keeps the path, so two shops on one host are told apart', () => {
		expect(hostOf('http://localhost:8080/joomla6')).toBe('localhost:8080/joomla6');
		expect(hostOf('http://localhost:8080/joomla6_store2')).toBe('localhost:8080/joomla6_store2');
		expect(hostOf('http://localhost:8080/joomla6')).not.toBe(hostOf('http://localhost:8080/joomla6_store2'));
	});

	it('drops a trailing slash on the path', () => {
		expect(hostOf('https://myshop.com/shop/')).toBe('myshop.com/shop');
	});

	it('hands back anything it cannot parse, rather than nothing', () => {
		expect(hostOf('not a url')).toBe('not a url');
	});
});
