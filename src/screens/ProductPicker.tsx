import { useEffect, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { ProductSummary } from '../core';
import { Modal, Search, Spinner, Money } from '../ui';

// A modal to search the catalogue and pick one product (for bundle / options / related).
// excludeIds hides products already chosen (and the product itself).
export function ProductPicker({ excludeIds = [], onClose, onPick }: {
	excludeIds?: number[];
	onClose: () => void;
	onPick: (p: ProductSummary) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const [search, setSearch] = useState('');
	const [items, setItems] = useState<ProductSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [err, setErr] = useState('');

	useEffect(() => {
		if (!client) return;
		let alive = true;
		setLoading(true); setErr('');
		const id = setTimeout(() => {
			void (async () => {
				try {
					const p = await client.getProducts({ search: search || undefined, limit: 30 });
					if (alive) setItems(p.items);
				} catch (e) {
					if (alive) setErr(tError(t, codeOf(e)));
				} finally {
					if (alive) setLoading(false);
				}
			})();
		}, search ? 300 : 0);
		return () => { alive = false; clearTimeout(id); };
	}, [client, search, t]);

	const exclude = new Set(excludeIds);
	const shown = items.filter((p) => !exclude.has(p.id));

	return (
		<Modal title={t('related.pickProduct')} onClose={onClose}>
			<Search value={search} onChange={setSearch} placeholder={t('products.search')} />
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : err ? (
				<div className="hk-error-note">{err}</div>
			) : shown.length === 0 ? (
				<div className="hk-empty">{t('products.none')}</div>
			) : (
				<div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
					{shown.map((p) => (
						<button key={p.id} type="button" className="hk-row hk-row--btn" onClick={() => onPick(p)}>
							{p.image ? <img className="hk-avatar-img" src={p.image} alt="" loading="lazy" /> : <div className="hk-avatar">{(p.name || '?').charAt(0).toUpperCase()}</div>}
							<div className="hk-row-grow">
								<span className="hk-row-title">{p.name}</span>
								<span className="hk-row-sub">{p.code}</span>
							</div>
							{p.price !== null && <span className="hk-row-rt"><Money value={p.price} currency={p.currency_id} /></span>}
						</button>
					))}
				</div>
			)}
		</Modal>
	);
}

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}
