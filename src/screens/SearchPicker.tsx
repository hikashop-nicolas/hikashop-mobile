import { useEffect, useState } from 'react';
import { useT, tError } from '../i18n';
import { Modal, Search, Spinner } from '../ui';

export interface PickItem { id: number; label: string; sub?: string }

// A generic search-and-pick modal: type to search (via the provided async fn), tap a
// result to pick it. Used for the price user / zone restriction pickers.
export function SearchPicker({ title, placeholder, minChars = 0, search, excludeIds = [], onClose, onPick }: {
	title: string;
	placeholder?: string;
	minChars?: number;
	search: (q: string) => Promise<PickItem[]>;
	excludeIds?: number[];
	onClose: () => void;
	onPick: (item: PickItem) => void;
}) {
	const t = useT();
	const [query, setQuery] = useState('');
	const [items, setItems] = useState<PickItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState('');

	useEffect(() => {
		if (query.trim().length < minChars) { setItems([]); return; }
		let alive = true;
		setLoading(true); setErr('');
		const id = setTimeout(() => {
			void (async () => {
				try { const r = await search(query.trim()); if (alive) setItems(r); }
				catch (e) { if (alive) setErr(tError(t, codeOf(e))); }
				finally { if (alive) setLoading(false); }
			})();
		}, 300);
		return () => { alive = false; clearTimeout(id); };
	}, [query, minChars, search, t]);

	const exclude = new Set(excludeIds);
	const shown = items.filter((i) => !exclude.has(i.id));

	return (
		<Modal title={title} onClose={onClose}>
			<Search value={query} onChange={setQuery} placeholder={placeholder} />
			{loading ? (
				<div className="hk-center-col"><Spinner /></div>
			) : err ? (
				<div className="hk-error-note">{err}</div>
			) : query.trim().length < minChars ? (
				<div className="hk-empty">{t('picker.typeToSearch')}</div>
			) : shown.length === 0 ? (
				<div className="hk-empty">{t('picker.noResults')}</div>
			) : (
				<div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
					{shown.map((it) => (
						<button key={it.id} type="button" className="hk-row hk-row-btn" onClick={() => onPick(it)}>
							<div className="hk-row-grow"><span className="hk-row-title">{it.label}</span>{it.sub && <span className="hk-row-sub">{it.sub}</span>}</div>
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
