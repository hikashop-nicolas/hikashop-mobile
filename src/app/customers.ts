// Pure helpers for the customer screens: address grouping/default resolution, group-editor
// visibility, and profile-patch building. Kept out of the components so they can be unit-tested.
import type { CustomerAddress, CustomerDetail, AssignableGroup } from '../core';

export type AddressType = 'billing' | 'shipping';

// Addresses of a given type. An address with no explicit type is treated as billing (HikaShop's
// legacy "both"/empty rows behave as billing in the app's grouping).
export function addressesOfType(addresses: CustomerAddress[] | undefined, type: AddressType): CustomerAddress[] {
	return (addresses ?? []).filter((a) => (a.types ?? []).length === 0 ? type === 'billing' : (a.types ?? []).includes(type));
}

// The default address id for a type: a lone address is the de-facto default; otherwise the first
// address flagged default; 0 when the type has none. Guarantees at most one default per type.
export function defaultAddressId(list: CustomerAddress[]): number {
	if (list.length === 1) return list[0].id;
	return list.find((a) => a.default)?.id ?? 0;
}

// Whether a "set as default" action should be offered for an address: only when there is another
// address of the type to switch away from, and this one is not already the default.
export function canSetDefault(list: CustomerAddress[], addressId: number): boolean {
	return list.length > 1 && addressId !== defaultAddressId(list);
}

// Groups to render in the editor: assignable ones, plus any non-assignable group the customer
// already has (shown locked so it is never silently dropped on save).
export function editableGroups(available: AssignableGroup[], selected: ReadonlySet<number>): AssignableGroup[] {
	return available.filter((g) => g.assignable || selected.has(g.id));
}

export interface ProfileForm {
	name: string;
	email: string;
	username: string;
	password: string;
	groups: ReadonlySet<number>;
	custom: Record<string, string>;
}

// Build the minimal update payload from the form vs the loaded customer: only changed scalar
// fields are sent; username/password/groups apply to a registered, editable account only, and
// groups only where the platform can persist them (groups_editable). Custom fields are sent when
// the customer has any (their values are always full).
export function buildProfilePatch(customer: CustomerDetail, form: ProfileForm): {
	name?: string; email?: string; username?: string; password?: string; groups?: number[]; custom_fields?: Record<string, string>;
} {
	const registered = customer.type !== 'guest' && customer.cms_id > 0;
	const patch: { name?: string; email?: string; username?: string; password?: string; groups?: number[]; custom_fields?: Record<string, string> } = {};
	if (form.name !== customer.name) patch.name = form.name;
	if (form.email !== customer.email) patch.email = form.email;
	if (registered && customer.can_edit_account) {
		if (form.username !== customer.username) patch.username = form.username;
		if (form.password) patch.password = form.password;
		if (customer.groups_editable) patch.groups = [...form.groups];
	}
	if (customer.fields.length > 0) patch.custom_fields = form.custom;
	return patch;
}
