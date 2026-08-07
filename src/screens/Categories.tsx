import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { CategoryListItem } from '../core';
import { flattenTree } from '../core';
import { Screen, Spinner, Icon, Button } from '../ui';

type Kind = 'product' | 'manufacturer';

export function Categories() {
	const { client, active, cache } = useStores();
	const t = useT();
	const nav = useNavigate();
	const storeId = active?.id ?? '';
	const [kind, setKind] = useState<Kind>('product');
	const [busyId, setBusyId] = useState(0);
	const [bump, setBump] = useState(0);

	const { data, loading, error } = useCached<CategoryListItem[]>({
		enabled: !!client && !!active,
		read: () => cache.getCategories(storeId, kind),
		fetch: () => client!.listCategories(kind),
		write: async (c) => { await cache.putCategories(storeId, kind, c); },
		deps: [storeId, kind, bump],
	});

	const rows = useMemo(() => flattenTree(data ?? []), [data]);

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
			right={<Button variant="pri" size="sm" onClick={() => nav(`/categories/new?type=${kind}`)}><Icon name="plus" size={16} /> {t('categories.new')}</Button>}
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
							<button type="button" className="hk-row-grow hk-row-btn" onClick={() => nav(`/categories/${item.id}/edit`)}>
								<span className="hk-row-title">{item.name}{!item.published && <span className="hk-status hk-status--neutral" style={{ marginLeft: 'var(--hk-s2)' }}>{t('product.unpublished')}</span>}</span>
							</button>
							<button type="button" className="hk-iconbtn hk-danger" disabled={busyId === item.id} onClick={() => void del(item.id)} aria-label={t('common.delete')}>
								<Icon name="trash" size={18} />
							</button>
						</div>
					))}
				</div>
			)}
		</Screen>
	);
}
