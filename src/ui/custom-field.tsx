import { useRef, useState } from 'react';
import type { ProductField, FieldFile } from '../core';
import { readAsDataUrl } from '../core';
import { Field } from './molecules';
import { RichText } from './rich-text';
import { Icon } from './icons';

// Render one shop-defined custom field by its type. Scalar types report through
// onChange(value); ajax image/file types manage a FieldFile[] via onUpload + onFiles
// (their column value is the pipe-joined path list, kept by the caller).
export function CustomFieldInput({ field, value, files, readOnlyLabel, onChange, onUpload, onFiles }: {
	field: ProductField;
	value: string;
	files: FieldFile[];
	readOnlyLabel: string;
	onChange: (value: string) => void;
	onUpload?: (data: string, name: string) => Promise<FieldFile>;
	onFiles?: (files: FieldFile[]) => void;
}) {
	const t = field.type;

	if (t === 'ajaximage' || t === 'ajaxfile') {
		if (!onUpload || !onFiles) {
			return <Field label={field.label}><span className="hk-muted">{readOnlyLabel}</span></Field>;
		}
		return <Field label={field.label}><AjaxFiles field={field} files={files} onUpload={onUpload} onFiles={onFiles} /></Field>;
	}
	if (t === 'wysiwyg') {
		return <Field label={field.label}><RichText value={value} onChange={onChange} /></Field>;
	}
	if (t === 'date' || t === 'datepicker') {
		return <Field label={field.label}><input className="hk-input" type="date" value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
	}
	if (t === 'textarea') {
		return <Field label={field.label}><textarea className="hk-input hk-textarea" rows={3} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
	}
	if ((t === 'singledropdown' || t === 'radio') && field.options.length > 0) {
		return (
			<Field label={field.label}>
				<select className="hk-select" value={value} onChange={(e) => onChange(e.target.value)}>
					<option value="">-</option>
					{field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
				</select>
			</Field>
		);
	}
	const inputType = t === 'number' || t === 'integer' ? 'number' : t === 'email' ? 'email' : t === 'url' ? 'url' : t === 'tel' ? 'tel' : t === 'color' ? 'color' : 'text';
	return <Field label={field.label}><input className="hk-input" type={inputType} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
}

// Upload widget for an ajax image / file field: previews (images) or a name list
// (files), add + remove, honouring the field's `multiple` flag.
function AjaxFiles({ field, files, onUpload, onFiles }: {
	field: ProductField;
	files: FieldFile[];
	onUpload: (data: string, name: string) => Promise<FieldFile>;
	onFiles: (files: FieldFile[]) => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const isImage = field.type === 'ajaximage';
	const accept = isImage ? 'image/*' : (field.allowed_extensions ? field.allowed_extensions.split(',').map((e) => `.${e.trim()}`).join(',') : undefined);

	async function pick(list: FileList | null) {
		if (!list || list.length === 0 || busy) return;
		setBusy(true);
		try {
			const added: FieldFile[] = [];
			for (const f of Array.from(list)) {
				const data = await readAsDataUrl(f);
				added.push(await onUpload(data, f.name));
			}
			onFiles(field.multiple ? [...files, ...added] : added.slice(-1));
		} finally { setBusy(false); }
	}
	const remove = (path: string) => onFiles(files.filter((f) => f.path !== path));

	return (
		<div>
			{isImage ? (
				<div className="hk-media-grid">
					{files.map((f) => (
						<div key={f.path} className="hk-media-cell">
							<img src={f.url} alt={f.name} loading="lazy" />
							<button type="button" className="hk-media-del" disabled={busy} aria-label="remove" onClick={() => remove(f.path)}><Icon name="close" size={13} /></button>
						</div>
					))}
					{(field.multiple || files.length === 0) && (
						<button type="button" className="hk-media-add" disabled={busy} onClick={() => input.current?.click()}><Icon name="plus" size={22} /></button>
					)}
				</div>
			) : (
				<div>
					{files.map((f) => (
						<div key={f.path} className="hk-row">
							<span className="hk-row-grow hk-row-title">{f.name}</span>
							<button type="button" className="hk-iconbtn hk-danger" disabled={busy} aria-label="remove" onClick={() => remove(f.path)}><Icon name="trash" size={18} /></button>
						</div>
					))}
					{(field.multiple || files.length === 0) && (
						<button type="button" className="hk-btn hk-btn--block" style={{ marginTop: 'var(--hk-s2)' }} disabled={busy} onClick={() => input.current?.click()}>
							<span className="hk-btn-ic"><Icon name="plus" size={18} /> +</span>
						</button>
					)}
				</div>
			)}
			<input ref={input} type="file" accept={accept} multiple={field.multiple} hidden onChange={(e) => void pick(e.target.files)} />
		</div>
	);
}
