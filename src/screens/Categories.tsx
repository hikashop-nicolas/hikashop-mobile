import { useMemo, useState } from 'react';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { CategoryListItem, CategoryDetail, ProductMeta } from '../core';
import { Screen, Spinner, Icon } from '../ui';
import type { TreeNode } from '../ui';
import { CategoryEditor } from './CategoryEditor';

type Kind = 'product' | 'manufacturer';

// Flatten a parent-linked list into depth-ordered rows for an indented tree view.
function ordered(items: CategoryListItem[]): { item: CategoryListItem; depth: number }[] {
	const byParent = new Map<number, CategoryListItem[]>();
	const ids = new Set(items.map((i) => i.id));
	for (const i of items) {
		const key = ids.has(i.parent_id) ? i.parent_id : 0;
		const arr = byParent.get(key) ?? [];
		arr.push(i);
		byParent.set(key, arr);
	}
	const out: { item: CategoryListItem; depth: number }[] = [];
	const walk = (parent: number, depth: number) => {
		for (const i of byParent.get(parent) ?? []) {
			out.push({ item: i, depth });
			walk(i.id, depth + 1);
		}
	};
	walk(0, 0);
	return out;
}

export function Categories() {
	const { client, active, cache } = useStores();
	const t = useT();
	const storeId = active?.id ?? '';
	const [kind, setKind] = useState<Kind>('product');
	const [editor, setEditor] = useState<{ category: CategoryDetail | null } | null>(null);
	const [busyId, setBusyId] = useState(0);
	const [bump, setBump] = useState(0);

	const { data, loading, error } = useCached<CategoryListItem[]>({
		enabled: !!client && !!active,
		read: () => cache.getCategories(storeId, kind),
		fetch: () => client!.listCategories(kind),
		write: async (c) => { await cache.putCategories(storeId, kind, c); },
		deps: [storeId, kind, bump],
	});
	const { data: meta } = useCached<ProductMeta>({
		enabled: !!client && !!active,
		read: () => cache.getProductMeta(storeId),
		fetch: () => client!.getProductMeta(),
		write: async (m) => { await cache.putProductMeta(storeId, m); },
		deps: [storeId],
	});

	const rows = useMemo(() => ordered(data ?? []), [data]);
	const parentNodes: TreeNode[] = (data ?? []).map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id }));

	async function openEdit(id: number) {
		if (!client) return;
		const category = await client.getCategory(id);
		setEditor({ category });
	}

	async function del(id: number) {
		if (!client || busyId) return;
		if (!window.confirm(t('category.deleteConfirm'))) return;
		setBusyId(id);
		try {
			await client.deleteCategory(id);
			setBump((b) => b + 1);
		} catch { /* stays in the list; retryable */ }
		finally { setBusyId(0); }
	}

	return (
		<Screen
			title={t('categories.title')}
			right={<button className="hk-appbar-act" onClick={() => setEditor({ category: null })}><span className="hk-btn-ic"><Icon name="plus" size={18} /> {t('categories.new')}</span></button>}
		>
			<div className="hk-filter-bar">
				<button type="button" className={`hk-chip${kind === 'product' ? ' hk-on' : ''}`} onClick={() => setKind('product')}>{t('categories.categories')}</button>
				<button type="button" className={`hk-chip${kind === 'manufacturer' ? ' hk-on' : ''}`} onClick={() => setKind('manufacturer')}>{t('categories.brands')}</button>
			</div>

			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : rows.length === 0 ? (
				<div className="hk-empty">{t('categories.none')}</div>
			) : (
				<div>
					{rows.map(({ item, depth }) => (
						<div key={item.id} className="hk-row" style={{ paddingLeft: `calc(${depth} * 1.25rem)` }}>
							<button type="button" className="hk-row-grow hk-row-btn" onClick={() => void openEdit(item.id)}>
								<span className="hk-row-title">{item.name}{!item.published && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('product.unpublished')}</span>}</span>
							</button>
							<button type="button" className="hk-iconbtn hk-danger" disabled={busyId === item.id} onClick={() => void del(item.id)} aria-label={t('common.delete')}>
								<Icon name="trash" size={18} />
							</button>
						</div>
					))}
				</div>
			)}

			{editor && (
				<CategoryEditor
					kind={editor.category ? (editor.category.type === 'manufacturer' ? 'manufacturer' : 'product') : kind}
					category={editor.category}
					meta={meta}
					parentNodes={parentNodes}
					onClose={() => setEditor(null)}
					onSaved={() => { setEditor(null); setBump((b) => b + 1); }}
				/>
			)}
		</Screen>
	);
}
