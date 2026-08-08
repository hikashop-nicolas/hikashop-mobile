import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useCached } from '../app/use-cached';
import { useT } from '../i18n';
import type { CategoryDetail, ProductMeta } from '../core';
import { Screen, Spinner, Icon } from '../ui';
import { CategoryEditor } from './CategoryEditor';
import { useDataChanged } from '../app/data-changed';

// Full-screen host for the category editor, reached from the category listing
// (create via /categories/new?type=..., edit via /categories/:id/edit).
export function CategoryEdit() {
	const { id } = useParams();
	const nav = useNavigate();
	const [sp] = useSearchParams();
	const { client, active, cache } = useStores();
	const t = useT();
	const changed = useDataChanged();
	const storeId = active?.id ?? '';
	const editing = !!id;

	const [category, setCategory] = useState<CategoryDetail | null>(null);
	const [loaded, setLoaded] = useState(!editing);
	useEffect(() => {
		if (!client || !editing) return;
		let alive = true;
		void (async () => {
			try { const c = await client.getCategory(Number(id)); if (alive) setCategory(c); }
			finally { if (alive) setLoaded(true); }
		})();
		return () => { alive = false; };
	}, [client, id, editing]);

	const kind: 'product' | 'manufacturer' = category
		? (category.type === 'manufacturer' ? 'manufacturer' : 'product')
		: (sp.get('type') === 'manufacturer' ? 'manufacturer' : 'product');

	const { data: meta } = useCached<ProductMeta>({
		enabled: !!client && !!active,
		read: () => cache.getProductMeta(storeId),
		fetch: () => client!.getProductMeta(),
		write: async (m) => { await cache.putProductMeta(storeId, m); },
		deps: [storeId],
	});


	if (!loaded) {
		return (
			<Screen title={t('categories.title')} left={<button className="hk-iconbtn" onClick={() => nav('/categories')} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}>
				<div className="hk-center-col"><Spinner /></div>
			</Screen>
		);
	}

	return (
		<CategoryEditor
			kind={kind}
			category={category}
			meta={meta ?? null}
			presentation="screen"
			onClose={() => nav('/categories')}
			onSaved={() => { changed.bump('categories'); nav('/categories'); }}
			onDelete={editing ? async () => { await client!.deleteCategory(Number(id)); changed.bump('categories'); nav('/categories'); } : undefined}
		/>
	);
}
