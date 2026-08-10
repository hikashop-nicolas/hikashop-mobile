import { useMemo, useRef, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import { readAsDataUrl, WRITABLE_FIELD_TYPES } from '../core';
import type { ProductMeta, ProductField, CategoryDetail, FieldFile, Access } from '../core';
import { Modal, Screen, Field, Button, Icon, RichText, CustomFieldInput, DeleteButton, ImageViewer } from '../ui';
import type { TreeNode } from '../ui';
import { AccessField, toAccess } from './AccessField';
import { CategoryPicker } from './CategoryPicker';
import { MediaBrowser } from './MediaBrowser';

type Kind = 'product' | 'manufacturer';

// A full create / edit form for a category or a manufacturer (both are HikaShop
// categories): name, parent, description, image, published and category custom fields.
// Presents as a modal (inline create from the product editor) or a full screen
// (from the category management listing).
export function CategoryEditor({ kind, category, meta, onClose, onSaved, onDelete, presentation = 'modal' }: {
	kind: Kind;
	category?: CategoryDetail | null;
	meta: ProductMeta | null;
	onClose: () => void;
	onSaved: (node: TreeNode) => void;
	onDelete?: () => void | Promise<void>;
	presentation?: 'modal' | 'screen';
}) {
	const { client } = useStores();
	const t = useT();
	const imgInput = useRef<HTMLInputElement>(null);
	const editing = !!category;

	const [name, setName] = useState(category?.name ?? '');
	const [parent, setParent] = useState<number[]>(category?.parent_id ? [category.parent_id] : []);
	const [description, setDescription] = useState(category?.description ?? '');
	const [published, setPublished] = useState(category?.published ?? true);
	const [access, setAccess] = useState<Access>(toAccess(category?.access));
	const [existingImage] = useState(category?.image ?? '');
	// A replacement image, from the device (data) or from the shop's media library (path).
	// Whichever was chosen last is the one that gets saved.
	const [image, setImage] = useState<{ name: string; preview: string; data?: string; path?: string } | null>(null);
	const [browsing, setBrowsing] = useState(false);
	const [viewing, setViewing] = useState(false);
	const [custom, setCustom] = useState<Record<string, string>>(() => {
		const c: Record<string, string> = {};
		for (const [k, v] of Object.entries(category?.custom_fields ?? {})) c[k] = v ?? '';
		return c;
	});
	const [customFiles, setCustomFiles] = useState<Record<string, FieldFile[]>>(category?.custom_field_files ?? {});
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	const fields: ProductField[] = useMemo(() => category?.fields ?? meta?.category_fields ?? [], [category, meta]);
	const isWritable = (f: ProductField) => WRITABLE_FIELD_TYPES.includes(f.type);
	function setCustomFieldFiles(namekey: string, next: FieldFile[]) {
		setCustomFiles((cf) => ({ ...cf, [namekey]: next }));
		setCustom((c) => ({ ...c, [namekey]: next.map((f) => f.path).join('|') }));
	}
	// Exclude the category itself (and later, ideally its subtree) from parent choices.

	async function pickImage(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		const data = await readAsDataUrl(file);
		setImage({ data, name: file.name, preview: data });
	}

	// Chosen in the media library: nothing is uploaded, the category just points at the file.
	async function pickFromLibrary(path: string, name: string, url: string) {
		setImage({ path, name, preview: url });
		setBrowsing(false);
	}

	// Cropped in the library: the same shape as a file picked off the device, since an edited
	// image is a new file rather than a reference to the one it came from.
	async function pickEdited(blob: Blob, name: string) {
		const data = await readAsDataUrl(new File([blob], name, { type: blob.type }));
		setImage({ data, name, preview: data });
		setBrowsing(false);
	}

	function writableCustom(): Record<string, string> {
		const out: Record<string, string> = {};
		for (const f of fields) if (isWritable(f) && f.namekey in custom) out[f.namekey] = custom[f.namekey] ?? '';
		return out;
	}

	async function submit() {
		if (!client || busy) return;
		if (name.trim() === '') { setErr(t('category.nameRequired')); return; }
		setErr('');
		setBusy(true);
		try {
			const body = {
				name: name.trim(),
				parent_id: parent[0] || undefined,
				description,
				published,
				access,
				image: image?.data,
				image_name: image?.name,
				image_path: image?.path,
				custom_fields: writableCustom(),
			};
			let saved: { id: number; name: string; parent_id: number };
			if (editing) {
				saved = await client.updateCategory(category!.id, body);
			} else {
				saved = kind === 'manufacturer' ? await client.createManufacturer(body) : await client.createCategory(body);
			}
			onSaved({ id: saved.id, name: saved.name, parent_id: saved.parent_id });
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setErr(tError(t, code));
			setBusy(false);
		}
	}

	const brand = kind === 'manufacturer';
	const title = editing ? (brand ? t('category.editBrand') : t('category.editCategory')) : (brand ? t('category.newBrand') : t('category.newCategory'));
	const preview = image?.preview ?? existingImage;

	const body = (
		<div className="hk-form">
				<Field label={t('category.name')}><input className="hk-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>

				<Field label={t('category.parent')}>
					<CategoryPicker type={brand ? 'manufacturer' : 'product'} selected={parent} onChange={setParent} multiple={false}
						excludeId={editing ? category!.id : undefined}
						searchPlaceholder={brand ? t('product.searchBrands') : t('product.searchCategories')}
						emptyLabel={brand ? t('product.noBrands') : t('product.noCategories')} />
				</Field>

				<Field label={t('category.description')}><RichText value={description} onChange={setDescription} label={t('category.description')} /></Field>

				{/* Two ways to an image, the same two a product has: send one from the device, or
				    take one already on the site. */}
				<Field label={t('category.image')}>
					<input ref={imgInput} type="file" accept="image/*" hidden onChange={(e) => void pickImage(e.target.files)} />
					<div className="hk-cat-imgrow">
						{preview ? (
							<div className="hk-cat-img">
								<img src={preview} alt="" />
								<button type="button" className="hk-media-view" onClick={() => setViewing(true)} aria-label={t('media.viewImage')}><Icon name="eye" size={13} /></button>
							</div>
						) : (
							<button type="button" className="hk-media-add hk-cat-imgadd" aria-label={t('product.addImage')} onClick={() => imgInput.current?.click()}><Icon name="plus" size={20} /></button>
						)}
						<div className="hk-cat-imgacts">
							<Button size="sm" onClick={() => imgInput.current?.click()}><Icon name="upload" size={15} /> {t('category.imageUpload')}</Button>
							<Button size="sm" onClick={() => setBrowsing(true)}><Icon name="image" size={15} /> {t('media.browse')}</Button>
						</div>
					</div>
				</Field>

				<AccessField label={t('product.access')} value={access} onChange={setAccess} />
				<label className="hk-check"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /><span>{t('product.publishedLabel')}</span></label>

				{fields.map((f) => (
					<CustomFieldInput key={f.namekey} field={f} value={custom[f.namekey] ?? ''} files={customFiles[f.namekey] ?? []}
						readOnlyLabel={t('product.fieldReadOnly')}
						onChange={(v) => setCustom((c) => ({ ...c, [f.namekey]: v }))}
						onUpload={(data, name) => client!.uploadFieldFile('category', f.namekey, { data, name })}
						onFiles={(next) => setCustomFieldFiles(f.namekey, next)} />
				))}

				{err && <div className="hk-error-note">{err}</div>}

				{/* Deleting the entity lives with its edit form, like every other entity in the app. */}
				{editing && onDelete && (
					<DeleteButton block disabled={busy} label={t('category.deleteCategory')}
						confirmMessage={t('category.deleteConfirm')} onConfirm={onDelete} />
				)}

				{browsing && (
					<MediaBrowser
						kind="images"
						onClose={() => setBrowsing(false)}
						onPick={pickFromLibrary}
						onPickEdited={pickEdited}
					/>
				)}
				{viewing && preview && (
					<ImageViewer images={[{ url: preview, label: image?.name ?? name }]} onClose={() => setViewing(false)} />
				)}
			</div>
	);

	const saveLabel = busy ? t('product.saving') : editing ? t('common.save') : t('common.create');

	if (presentation === 'screen') {
		return (
			<Screen
				title={title}
				left={<button className="hk-iconbtn" onClick={onClose} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
				right={<Button variant="pri" size="sm" disabled={busy} onClick={() => void submit()}>{saveLabel}</Button>}
			>
				{body}
			</Screen>
		);
	}

	return (
		<Modal title={title} onClose={onClose}
			footer={<>
				<Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
				<Button variant="pri" onClick={() => void submit()} disabled={busy}>{saveLabel}</Button>
			</>}
		>
			{body}
		</Modal>
	);
}
