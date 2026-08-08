import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT, tError } from '../i18n';
import type { CategoryListItem } from '../core';
import { flattenTree } from '../core';
import { Screen, Spinner, NewButton } from '../ui';

type Kind = 'product' | 'manufacturer';

export function Categories() {
	const { client, active, cache } = useStores();
	const t = useT();
	const nav = useNavigate();
	const storeId = active?.id ?? '';
	const [kind, setKind] = useState<Kind>('product');

	const { data, loading, error } = useCached<CategoryListItem[]>({
		enabled: !!client && !!active,
		read: () => cache.getCategories(storeId, kind),
		fetch: () => client!.listCategories(kind),
		write: async (c) => { await cache.putCategories(storeId, kind, c); },
		deps: [storeId, kind],
	});

	const rows = useMemo(() => flattenTree(data ?? []), [data]);

	return (
		<Screen
			title={t('categories.title')}
			right={<NewButton onClick={() => nav(`/categories/new?type=${kind}`)} />}
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
						</div>
					))}
				</div>
			)}
		</Screen>
	);
}
