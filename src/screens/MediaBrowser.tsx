import { useEffect, useRef, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import type { MediaListing } from '../core';
import { Modal, Button, Spinner, Icon, Search, LoadMore } from '../ui';
import { ImageEditor, editedName } from './ImageEditor';
import type { ImageEditorHandle } from './ImageEditor';

// A HikaShop-style media picker: folders on the left, items on the right. Selecting
// one and confirming attaches it (by path) to the product. For images it shows a
// thumbnail grid; for downloadable files (no public url) a name list.
// How long the two views take to change places. The same half second a record takes to open
// elsewhere in the app, so it reads as the same gesture; kept in step with --hk-detail-ms.
const PANE_MS = 500;

export function MediaBrowser({ kind = 'images', onClose, onPick, onPickEdited }: {
	kind?: 'images' | 'files';
	onClose: () => void;
	// The url comes along so a caller that only shows the choice (rather than attaching it
	// straight away) can preview it without asking the shop where the file ended up.
	onPick: (path: string, name: string, url: string) => Promise<void>;
	// An edited copy, as bytes, for a caller that can upload one. Without it the edit button is
	// not offered, since there would be nowhere for the result to go.
	onPickEdited?: (blob: Blob, name: string) => Promise<void>;
}) {
	const { client } = useStores();
	const t = useT();
	const PAGE = 60;
	const [listing, setListing] = useState<MediaListing | null>(null);
	const [items, setItems] = useState<MediaListing['images']>([]);
	const [folder, setFolder] = useState('');
	const [loading, setLoading] = useState(true);
	const [more, setMore] = useState(false);
	const [err, setErr] = useState('');
	const [selected, setSelected] = useState<{ path: string; name: string; url: string } | null>(null);
	const [busy, setBusy] = useState(false);
	const [query, setQuery] = useState('');
	const [search, setSearch] = useState('');
	const [editing, setEditing] = useState<{ src: string; name: string } | null>(null);
	const [editorReady, setEditorReady] = useState(false);
	const editor = useRef<ImageEditorHandle>(null);
	// Which view is current, and which is still on screen sliding away. The one leaving stays
	// mounted for as long as the move takes, or there would be nothing to see leaving.
	const [pane, setPane] = useState<'list' | 'edit'>('list');
	const [leaving, setLeaving] = useState<'list' | 'edit' | null>(null);

	useEffect(() => {
		if (!leaving) return;
		const id = setTimeout(() => {
			setLeaving(null);
			// The editor's image is only let go once it is off screen.
			if (leaving === 'edit') {
				setEditing((e) => { if (e?.src) URL.revokeObjectURL(e.src); return null; });
				setEditorReady(false);
			}
		}, PANE_MS);
		return () => clearTimeout(id);
	}, [leaving]);
	const isFiles = kind === 'files';

	// Typing filters the whole folder, not the page in hand, so it is a query rather than a
	// local filter. Debounced, or every keystroke asks the shop.
	useEffect(() => {
		const id = setTimeout(() => setSearch(query.trim()), 250);
		return () => clearTimeout(id);
	}, [query]);

	useEffect(() => {
		if (!client) return;
		let alive = true;
		setLoading(true); setErr('');
		void (async () => {
			try {
				const l = await client.browseMedia(folder, isFiles ? 'file' : 'image', { search, limit: PAGE, offset: 0 });
				if (alive) { setListing(l); setItems(l.images); setSelected(null); }
			} catch (e) {
				if (alive) setErr(tError(t, codeOf(e)));
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => { alive = false; };
	}, [client, folder, isFiles, search, t]);

	async function loadMore() {
		if (!client || !listing || more) return;
		setMore(true); setErr('');
		try {
			const l = await client.browseMedia(folder, isFiles ? 'file' : 'image', { search, limit: PAGE, offset: items.length });
			setItems((prev) => [...prev, ...l.images]);
			setListing(l);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
		} finally {
			setMore(false);
		}
	}

	// The bytes come through the API rather than from the image's own url: the shop serves its
	// images without a cross-origin header, so a canvas that loads one directly is tainted and
	// the edited result could not be read back out.
	async function edit() {
		if (!client || !selected || busy) return;
		// The move starts at once and the image arrives into it. Waiting for the bytes first
		// meant a second of nothing happening after the button was pressed, on a file that can
		// be a megabyte.
		const from = selected;
		setEditing({ src: '', name: from.name });
		setLeaving('list');
		setPane('edit');
		setBusy(true); setErr('');
		try {
			const blob = await client.mediaContent(from.path);
			setEditing((e) => (e ? { ...e, src: URL.createObjectURL(blob) } : e));
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			closeEditor();
		} finally {
			setBusy(false);
		}
	}

	function closeEditor() {
		if (pane !== 'edit') return;
		setLeaving('edit');
		setPane('list');
	}

	async function saveEdited() {
		if (!editor.current || !editing || !onPickEdited || busy) return;
		setBusy(true); setErr('');
		try {
			const blob = await editor.current.save();
			await onPickEdited(blob, editedName(editing.name));
			closeEditor();
		} catch (e) {
			setErr(tError(t, codeOf(e)));
		} finally {
			setBusy(false);
		}
	}

	async function attach() {
		if (!selected || busy) return;
		setBusy(true); setErr('');
		try {
			await onPick(selected.path, selected.name, selected.url);
		} catch (e) {
			setErr(tError(t, codeOf(e)));
			setBusy(false);
		}
	}

	const total = listing?.total ?? 0;

	return (
		<Modal
			title={pane === 'edit' ? t('media.editTitle') : t('media.browseTitle')}
			size="wide"
			// While the editor is open, Escape and the backdrop go back to the library rather
			// than closing everything: the way out of a pane is the pane's own Cancel.
			onClose={pane === 'edit' ? closeEditor : onClose}
			footer={pane === 'edit' ? (
				<>
					<Button onClick={closeEditor} disabled={busy}>{t('common.cancel')}</Button>
					<Button variant="pri" disabled={busy || !editorReady} onClick={() => void saveEdited()}>
						<Icon name="check" size={16} /> {busy ? t('product.saving') : t('media.editSave')}
					</Button>
				</>
			) : (
				<>
					<Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
					{!isFiles && onPickEdited && (
						<Button disabled={busy || !selected} onClick={() => void edit()}>
							<Icon name="edit" size={16} /> {t('media.edit')}
						</Button>
					)}
					<Button variant="pri" onClick={() => void attach()} disabled={busy || !selected}><Icon name="check" size={16} /> {busy ? t('product.saving') : (isFiles ? t('media.useFile') : t('media.useImage'))}</Button>
				</>
			)}
		>
			<div className="hk-mbpane">
				{/* The library stays mounted behind the editor, hidden once it is off screen: it
				    holds the folder, the search, the scroll position and the selection, and
				    coming back to a listing that had forgotten all four would be worse than the
				    move is good. */}
				<div className={`hk-mbpane-view${
					leaving === 'list' ? ' hk-mbpane-view--out-left'
					: leaving === 'edit' ? ' hk-mbpane-view--in-left'
					: pane === 'edit' ? ' hk-mbpane-view--away' : ''}`}>
			<div className="hk-mb">
				<div className="hk-mb-tree">
					<button type="button" className={`hk-mb-folder${folder === '' ? ' hk-on' : ''}`} onClick={() => setFolder('')}>
						<Icon name="categories" size={16} /> {t('media.rootFolder')}
					</button>
					{listing?.has_parent && (
						<button type="button" className="hk-mb-folder" onClick={() => setFolder(listing.parent)}>
							<Icon name="back" size={16} /> {t('media.parentFolder')}
						</button>
					)}
					{(listing?.folders ?? []).map((f) => (
						<button key={f.path} type="button" className={`hk-mb-folder${folder === f.path ? ' hk-on' : ''}`} onClick={() => setFolder(f.path)}>
							<Icon name="categories" size={16} /> {f.name}
						</button>
					))}
				</div>
				<div className="hk-mb-grid">
					<div className="hk-mb-search">
						<Search value={query} onChange={setQuery} placeholder={t('media.searchHere')} />
					</div>
					{loading ? (
						<div className="hk-center-col"><Spinner /></div>
					) : items.length === 0 ? (
						<div className="hk-empty">{search ? t('media.noMatch') : isFiles ? t('media.noFiles') : t('media.noImages')}</div>
					) : isFiles ? (
						<div>
							{items.map((f) => (
								<button key={f.path} type="button" className={`hk-row hk-row--btn hk-mb-file${selected?.path === f.path ? ' hk-on' : ''}`} onClick={() => setSelected({ path: f.path, name: f.name, url: f.url })}>
									<span className="hk-row-title">{f.name}</span>
								</button>
							))}
						</div>
					) : (
						<div className="hk-media-grid">
							{items.map((img) => (
								<button key={img.path} type="button" className={`hk-media-cell hk-mb-cell${selected?.path === img.path ? ' hk-on' : ''}`} onClick={() => setSelected({ path: img.path, name: img.name, url: img.url })} title={img.name}>
									<img src={img.url} alt={img.name} loading="lazy" />
								</button>
							))}
						</div>
					)}
					{!loading && items.length > 0 && (
						<LoadMore
							shown={items.length}
							total={total}
							hasMore={items.length < total}
							loading={more}
							onLoad={() => void loadMore()}
						/>
					)}
				</div>
			</div>
				</div>
				{editing && onPickEdited && (pane === 'edit' || leaving === 'edit') && (
					<div className={`hk-mbpane-view${leaving === 'edit' ? ' hk-mbpane-view--out-right' : ' hk-mbpane-view--in-right'}`}>
						<ImageEditor ref={editor} src={editing.src} onReady={setEditorReady} />
					</div>
				)}
			</div>
			{err && <div className="hk-error-note">{err}</div>}
		</Modal>
	);
}

function codeOf(e: unknown): string {
	return (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
}
