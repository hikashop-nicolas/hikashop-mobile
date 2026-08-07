import { useState } from 'react';
import { useT } from '../i18n';
import type { RelatedProduct, ProductSummary } from '../core';
import { Icon, Button } from '../ui';
import { ProductPicker } from './ProductPicker';

type Kind = 'bundle' | 'options' | 'related';

// Manage a product's bundle / options / related sets. Bundle items carry a quantity;
// the others are plain links. Adding opens a product picker; the value is kept by the
// caller and sent in the product save body.
export function RelatedProducts({ productId, bundle, options, related, showBundle, onChange }: {
	productId: number;
	bundle: RelatedProduct[];
	options: RelatedProduct[];
	related: RelatedProduct[];
	showBundle: boolean;
	onChange: (kind: Kind, items: RelatedProduct[]) => void;
}) {
	const t = useT();
	const [picking, setPicking] = useState<Kind | null>(null);
	const sets: Record<Kind, RelatedProduct[]> = { bundle, options, related };

	function add(kind: Kind, p: ProductSummary) {
		if (sets[kind].some((r) => r.id === p.id)) { setPicking(null); return; }
		onChange(kind, [...sets[kind], { id: p.id, name: p.name, code: p.code, quantity: kind === 'bundle' ? 1 : 0 }]);
		setPicking(null);
	}
	const remove = (kind: Kind, id: number) => onChange(kind, sets[kind].filter((r) => r.id !== id));
	const setQty = (id: number, q: number) => onChange('bundle', bundle.map((r) => (r.id === id ? { ...r, quantity: Math.max(1, q) } : r)));

	const groups: { kind: Kind; label: string; show: boolean }[] = [
		{ kind: 'bundle', label: t('related.bundle'), show: showBundle },
		{ kind: 'options', label: t('related.options'), show: true },
		{ kind: 'related', label: t('related.related'), show: true },
	];

	return (
		<div className="hk-card hk-card--pad hk-form">
			<span className="hk-muted">{t('related.title')}</span>
			{groups.filter((g) => g.show).map((g) => (
				<div key={g.kind}>
					<div className="hk-sect-head"><span className="hk-row-sub">{g.label}</span>
						<Button size="sm" onClick={() => setPicking(g.kind)}><Icon name="plus" size={16} /> {t('common.add')}</Button></div>
					{sets[g.kind].length === 0 ? (
						<div className="hk-row-sub" style={{ padding: 'var(--hk-s1) 0' }}>{t('related.none')}</div>
					) : sets[g.kind].map((r) => (
						<div key={r.id} className="hk-row">
							<div className="hk-row-grow"><span className="hk-row-title">{r.name}</span><span className="hk-row-sub hk-mono">{r.code}</span></div>
							{g.kind === 'bundle' && (
								<input className="hk-input" type="number" inputMode="numeric" min={1} value={r.quantity || 1}
									onChange={(e) => setQty(r.id, parseInt(e.target.value, 10) || 1)} style={{ maxWidth: '4.5rem' }} aria-label={t('product.stock')} />
							)}
							<button type="button" className="hk-iconbtn hk-danger" aria-label={t('common.delete')} onClick={() => remove(g.kind, r.id)}><Icon name="trash" size={18} /></button>
						</div>
					))}
				</div>
			))}
			{picking && (
				<ProductPicker excludeIds={[productId, ...sets[picking].map((r) => r.id)]} onClose={() => setPicking(null)} onPick={(p) => add(picking, p)} />
			)}
		</div>
	);
}
