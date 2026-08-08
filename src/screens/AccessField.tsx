import { useEffect, useState } from 'react';
import { Field } from '../ui';
import { useT } from '../i18n';
import type { TFunc } from '../i18n';
import { useStores } from '../app/store-context';
import type { Access, UserGroup, ApiClient } from '../core';

// Every group list is the same list, and a product form can hold several of these at once (the
// product, each price, each file), so share one request per client rather than one per field.
// Keying on the client means switching store drops the cache with it.
const groupCache = new WeakMap<ApiClient, Promise<UserGroup[]>>();

function loadGroups(client: ApiClient): Promise<UserGroup[]> {
	let p = groupCache.get(client);
	if (!p) {
		p = client.getGroups().catch(() => {
			// Don't cache a failure: the next field to mount should retry.
			groupCache.delete(client);
			return [] as UserGroup[];
		});
		groupCache.set(client, p);
	}
	return p;
}

// Who can see a row: everyone, nobody, or named customer groups. HikaShop stores this the same
// way for products, categories, prices, files and discounts, so they all edit it the same way.
export function AccessField({ label, hint, value, onChange }: {
	label: string;
	hint?: string;
	value: Access;
	onChange: (a: Access) => void;
}) {
	const t = useT();
	const { client } = useStores();
	const [groups, setGroups] = useState<UserGroup[]>([]);

	useEffect(() => {
		if (!client) return;
		let alive = true;
		void loadGroups(client).then((g) => { if (alive) setGroups(g); });
		return () => { alive = false; };
	}, [client]);

	const toggle = (id: number) => onChange({
		mode: 'groups',
		groups: value.groups.includes(id) ? value.groups.filter((g) => g !== id) : [...value.groups, id],
	});

	return (
		<Field label={label} hint={hint}>
			<select
				className="hk-select"
				value={value.mode}
				onChange={(e) => {
					const mode = e.target.value as Access['mode'];
					// Keep the selection when switching away and back, so a mis-click is not costly.
					onChange({ mode, groups: mode === 'groups' ? value.groups : [] });
				}}>
				<option value="all">{t('access.all')}</option>
				<option value="none">{t('access.none')}</option>
				<option value="groups">{t('access.groups')}</option>
			</select>
			{value.mode === 'groups' && (
				<div className="hk-checkbox-list" style={{ marginTop: 'var(--hk-s2)' }}>
					{groups.map((g) => (
						<label key={g.id} className="hk-checkbox-row">
							<input type="checkbox" checked={value.groups.includes(g.id)} onChange={() => toggle(g.id)} />
							<span>{g.title}</span>
						</label>
					))}
					{groups.length === 0 && <div className="hk-empty">{t('access.noGroups')}</div>}
				</div>
			)}
		</Field>
	);
}

export const ACCESS_ALL: Access = { mode: 'all', groups: [] };

// Access used to be a plain column string, and a cache written by an older build still holds it
// that way, so every read goes through here rather than trusting the shape.
export function toAccess(a: Access | string | null | undefined): Access {
	if (a === null || a === undefined || a === '') return ACCESS_ALL;
	if (typeof a === 'string') {
		if (a === 'all' || a === 'none') return { mode: a, groups: [] };
		const groups = a.split(',').map((v) => parseInt(v, 10)).filter((v) => v > 0);
		return groups.length ? { mode: 'groups', groups } : ACCESS_ALL;
	}
	const mode = a.mode === 'none' || a.mode === 'groups' ? a.mode : 'all';
	return { mode, groups: Array.isArray(a.groups) ? a.groups : [] };
}

// A one-line description of a restriction for list rows; empty when nothing is restricted, so
// callers can drop the whole subtitle rather than print "everyone" on every row.
export function accessSummary(a: Access | string | undefined, t: TFunc): string {
	const v = toAccess(a);
	if (v.mode === 'all') return '';
	if (v.mode === 'none') return t('access.none');
	return t('access.groupCount', { count: v.groups.length });
}
