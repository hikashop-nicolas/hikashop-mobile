import { useMemo, useRef, useState } from 'react';
import { useStores } from '../app/store-context';
import { useT, tError } from '../i18n';
import { readAsDataUrl, WRITABLE_FIELD_TYPES } from '../core';
import type { ProductMeta, ProductField } from '../core';
import { Modal, Field, Button, Icon, TreeSelect } from '../ui';
import type { TreeNode } from '../ui';

type Kind = 'product' | 'manufacturer';

// A full create form for a category or a manufacturer (both are HikaShop categories):
// name, parent, description, image, published and any shop-defined category fields.
export function CategoryEditor({ kind, meta, parentNodes, onClose, onCreated }: {
	kind: Kind;
	meta: ProductMeta | null;
	parentNodes: TreeNode[];
	onClose: () => void;
	onCreated: (node: TreeNode) => void;
}) {
	const { client } = useStores();
	const t = useT();
	const imgInput = useRef<HTMLInputElement>(null);

	const [name, setName] = useState('');
	const [parent, setParent] = useState<number[]>([]);
	const [description, setDescription] = useState('');
	const [published, setPublished] = useState(true);
	const [image, setImage] = useState<{ data: string; name: string; preview: string } | null>(null);
	const [custom, setCustom] = useState<Record<string, string>>({});
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');

	const fields: ProductField[] = useMemo(() => meta?.category_fields ?? [], [meta]);
	const isWritable = (f: ProductField) => WRITABLE_FIELD_TYPES.includes(f.type);

	async function pickImage(files: FileList | null) {
		const file = files?.[0];
		if (!file) return;
		const data = await readAsDataUrl(file);
		setImage({ data, name: file.name, preview: data });
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
				description: description || undefined,
				published,
				image: image?.data,
				image_name: image?.name,
				custom_fields: writableCustom(),
			};
			const created = kind === 'manufacturer'
				? await client.createManufacturer(body)
				: await client.createCategory(body);
			onCreated({ id: created.id, name: created.name, parent_id: created.parent_id });
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setErr(tError(t, code));
			setBusy(false);
		}
	}

	const title = kind === 'manufacturer' ? t('category.newBrand') : t('category.newCategory');

	return (
		<Modal title={title} onClose={onClose}
			footer={<>
				<Button onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
				<Button variant="pri" onClick={() => void submit()} disabled={busy}>{busy ? t('product.saving') : t('common.create')}</Button>
			</>}
		>
			<div className="hk-form">
				<Field label={t('category.name')}><input className="hk-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></Field>

				<Field label={t('category.parent')}>
					<TreeSelect nodes={parentNodes} selected={parent} onChange={setParent} multiple={false}
						searchPlaceholder={kind === 'manufacturer' ? t('product.searchBrands') : t('product.searchCategories')}
						emptyLabel={kind === 'manufacturer' ? t('product.noBrands') : t('product.noCategories')} />
				</Field>

				<Field label={t('category.description')}><textarea className="hk-input hk-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>

				<Field label={t('category.image')}>
					<input ref={imgInput} type="file" accept="image/*" hidden onChange={(e) => void pickImage(e.target.files)} />
					{image ? (
						<div className="hk-cat-img">
							<img src={image.preview} alt="" />
							<button type="button" className="hk-media-del" onClick={() => setImage(null)} aria-label={t('common.cancel')}><Icon name="close" size={13} /></button>
						</div>
					) : (
						<button type="button" className="hk-media-add hk-cat-imgadd" onClick={() => imgInput.current?.click()}><Icon name="plus" size={20} /></button>
					)}
				</Field>

				<label className="hk-check"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /><span>{t('product.publishedLabel')}</span></label>

				{fields.map((f) => {
					if (!isWritable(f)) return null;
					const val = custom[f.namekey] ?? '';
					const setV = (v: string) => setCustom((c) => ({ ...c, [f.namekey]: v }));
					if (f.type === 'textarea') return <Field key={f.namekey} label={f.label}><textarea className="hk-input hk-textarea" rows={2} value={val} onChange={(e) => setV(e.target.value)} /></Field>;
					if ((f.type === 'singledropdown' || f.type === 'radio') && f.options.length > 0) {
						return <Field key={f.namekey} label={f.label}><select className="hk-select" value={val} onChange={(e) => setV(e.target.value)}><option value="">{t('product.none')}</option>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>;
					}
					return <Field key={f.namekey} label={f.label}><input className="hk-input" value={val} onChange={(e) => setV(e.target.value)} /></Field>;
				})}

				{err && <div className="hk-error-note">{err}</div>}
			</div>
		</Modal>
	);
}
