import { describe, it, expect } from 'vitest';
import { addressesOfType, defaultAddressId, canSetDefault, editableGroups, buildProfilePatch } from './customers';
import type { CustomerAddress, CustomerDetail, AssignableGroup } from '../core';

function addr(id: number, types: string[], def = false): CustomerAddress {
	return { id, types, name: 'A' + id, company: '', street: '', city: '', post_code: '', telephone: '', default: def };
}

describe('addressesOfType', () => {
	const list = [addr(1, ['billing']), addr(2, ['shipping']), addr(3, ['billing', 'shipping']), addr(4, [])];
	it('groups by type', () => {
		expect(addressesOfType(list, 'billing').map((a) => a.id)).toEqual([1, 3, 4]);
		expect(addressesOfType(list, 'shipping').map((a) => a.id)).toEqual([2, 3]);
	});
	it('treats a typeless address as billing', () => {
		expect(addressesOfType([addr(9, [])], 'billing').map((a) => a.id)).toEqual([9]);
		expect(addressesOfType([addr(9, [])], 'shipping')).toEqual([]);
	});
	it('handles undefined', () => {
		expect(addressesOfType(undefined, 'billing')).toEqual([]);
	});
});

describe('defaultAddressId', () => {
	it('a lone address is the default regardless of its flag', () => {
		expect(defaultAddressId([addr(5, ['billing'], false)])).toBe(5);
	});
	it('picks the flagged one when there are several', () => {
		expect(defaultAddressId([addr(1, ['billing']), addr(2, ['billing'], true)])).toBe(2);
	});
	it('picks only the first flagged one (never two defaults)', () => {
		expect(defaultAddressId([addr(1, ['billing'], true), addr(2, ['billing'], true)])).toBe(1);
	});
	it('is 0 when several exist and none is flagged', () => {
		expect(defaultAddressId([addr(1, ['billing']), addr(2, ['billing'])])).toBe(0);
	});
	it('is 0 for an empty list', () => {
		expect(defaultAddressId([])).toBe(0);
	});
});

describe('canSetDefault', () => {
	it('is never offered for a lone address', () => {
		expect(canSetDefault([addr(5, ['billing'])], 5)).toBe(false);
	});
	it('is offered on non-default siblings only', () => {
		const list = [addr(1, ['billing'], true), addr(2, ['billing'])];
		expect(canSetDefault(list, 1)).toBe(false); // already default
		expect(canSetDefault(list, 2)).toBe(true);
	});
});

const group = (id: number, title: string, assignable: boolean): AssignableGroup => ({ id, title, assignable });

describe('editableGroups', () => {
	const available = [group(2, 'Registered', true), group(8, 'Super Users', false)];
	it('shows assignable groups', () => {
		expect(editableGroups(available, new Set()).map((g) => g.id)).toEqual([2]);
	});
	it('keeps a non-assignable group the customer already has (locked)', () => {
		expect(editableGroups(available, new Set([8])).map((g) => g.id)).toEqual([2, 8]);
	});
});

function customer(over: Partial<CustomerDetail> = {}): CustomerDetail {
	return {
		id: 1, cms_id: 100, name: 'Jo', email: 'jo@x.com', username: 'jo', type: 'registered',
		blocked: false, can_edit_account: true, groups_editable: true,
		groups: [], available_groups: [], created: 0, addresses: [], orders: [],
		fields: [], custom_fields: {}, custom_field_files: {}, ...over,
	};
}
const form = (over: Partial<Parameters<typeof buildProfilePatch>[1]> = {}) => ({
	name: 'Jo', email: 'jo@x.com', username: 'jo', password: '', groups: new Set<number>(), custom: {}, ...over,
});

describe('buildProfilePatch', () => {
	it('only sends changed scalar fields', () => {
		expect(buildProfilePatch(customer(), form())).toEqual({ groups: [] });
		expect(buildProfilePatch(customer(), form({ name: 'Jane' }))).toMatchObject({ name: 'Jane' });
	});
	it('sends a password only when non-empty', () => {
		expect(buildProfilePatch(customer(), form()).password).toBeUndefined();
		expect(buildProfilePatch(customer(), form({ password: 'secret' })).password).toBe('secret');
	});
	it('omits username/password/groups for a guest', () => {
		const p = buildProfilePatch(customer({ type: 'guest', cms_id: 0 }), form({ username: 'x', password: 'y', groups: new Set([2]) }));
		expect(p.username).toBeUndefined();
		expect(p.password).toBeUndefined();
		expect(p.groups).toBeUndefined();
	});
	it('omits groups when the platform cannot persist them (groups_editable false)', () => {
		const p = buildProfilePatch(customer({ groups_editable: false }), form({ groups: new Set([2]) }));
		expect(p.groups).toBeUndefined();
	});
	it('omits account fields when the operator cannot edit the account', () => {
		const p = buildProfilePatch(customer({ can_edit_account: false }), form({ username: 'x', password: 'y', groups: new Set([2]) }));
		expect(p.username).toBeUndefined();
		expect(p.password).toBeUndefined();
		expect(p.groups).toBeUndefined();
	});
	it('sends custom_fields only when the customer has custom fields', () => {
		expect(buildProfilePatch(customer(), form({ custom: { a: '1' } })).custom_fields).toBeUndefined();
		const withFields = customer({ fields: [{ namekey: 'a', type: 'text', label: 'A', required: false, options: [] } as unknown as CustomerDetail['fields'][number]] });
		expect(buildProfilePatch(withFields, form({ custom: { a: '1' } })).custom_fields).toEqual({ a: '1' });
	});
});
