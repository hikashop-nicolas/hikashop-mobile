import { describe, it, expect } from 'vitest';
import { toAccess, accessSummary, ACCESS_ALL } from './AccessField';
import type { TFunc } from '../i18n';

// Stand-in for the real translator: echoes the key plus any params, so a test can assert which
// string was chosen without depending on the wording.
const t: TFunc = (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key);

describe('toAccess', () => {
	it('passes a well-formed value through', () => {
		expect(toAccess({ mode: 'groups', groups: [2, 6] })).toEqual({ mode: 'groups', groups: [2, 6] });
	});

	it('defaults an empty value to everyone', () => {
		for (const v of [null, undefined, '']) expect(toAccess(v)).toEqual(ACCESS_ALL);
	});

	// A cache written before access became structured still holds the raw column value.
	it('reads the legacy column string', () => {
		expect(toAccess('all')).toEqual({ mode: 'all', groups: [] });
		expect(toAccess('none')).toEqual({ mode: 'none', groups: [] });
		expect(toAccess(',2,6,')).toEqual({ mode: 'groups', groups: [2, 6] });
		expect(toAccess('2,6')).toEqual({ mode: 'groups', groups: [2, 6] });
	});

	it('repairs a partial object rather than throwing', () => {
		// This is the shape that blanked the product screen: mode present, groups missing.
		expect(toAccess({ mode: 'groups' } as never)).toEqual({ mode: 'groups', groups: [] });
		expect(toAccess({ groups: [2] } as never)).toEqual({ mode: 'all', groups: [2] });
		expect(toAccess({ mode: 'bogus', groups: [] } as never)).toEqual(ACCESS_ALL);
	});
});

describe('accessSummary', () => {
	it('says nothing when everyone can see it', () => {
		expect(accessSummary({ mode: 'all', groups: [] }, t)).toBe('');
		expect(accessSummary(undefined, t)).toBe('');
		expect(accessSummary('all', t)).toBe('');
	});

	it('names the restriction otherwise', () => {
		expect(accessSummary({ mode: 'none', groups: [] }, t)).toBe('access.none');
		expect(accessSummary({ mode: 'groups', groups: [2, 6] }, t)).toBe('access.groupCount:{"count":2}');
	});

	it('summarises a legacy value without throwing', () => {
		expect(accessSummary(',2,6,', t)).toBe('access.groupCount:{"count":2}');
	});
});
