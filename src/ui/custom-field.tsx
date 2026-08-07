import { useRef, useState } from 'react';
import type { ProductField, FieldFile } from '../core';
import { readAsDataUrl, hikaDateToIso, isoToHikaDate, isDateDisabled, isoRangeToHika, hikaToIsoRange, nightsBetween } from '../core';
import { useT } from '../i18n';
import { useHk } from '../app/hika-dict';
import { Field } from './molecules';
import { Button } from './atoms';
import { RichText } from './rich-text';
import { DateCalendar } from './date-calendar';
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
	const hk = useHk();

	if (t === 'ajaximage' || t === 'ajaxfile') {
		if (!onUpload || !onFiles) {
			return <Field label={field.label}><span className="hk-muted">{readOnlyLabel}</span></Field>;
		}
		return <Field label={field.label}><AjaxFiles field={field} files={files} onUpload={onUpload} onFiles={onFiles} /></Field>;
	}
	if (t === 'wysiwyg') {
		return <Field label={field.label}><RichText value={value} onChange={onChange} /></Field>;
	}
	if (t === 'datepicker') {
		// HikaShop's advanced picker stores yy/mm/dd; the native input works in ISO.
		return <Field label={field.label}><DatePicker field={field} value={value} onChange={onChange} /></Field>;
	}
	if (t === 'date') {
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
					{field.options.map((o) => <option key={o.value} value={o.value}>{o.label_key ? hk(o.label_key, o.label) : o.label}</option>)}
				</select>
			</Field>
		);
	}
	const inputType = t === 'number' || t === 'integer' ? 'number' : t === 'email' ? 'email' : t === 'url' ? 'url' : t === 'tel' ? 'tel' : t === 'color' ? 'color' : 'text';
	return <Field label={field.label}><input className="hk-input" type={inputType} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
}

// Advanced date picker (plg.datepickerfield): a dependency-free calendar that reproduces
// the storefront's constraints (allow past/future bounds, forbidden weekdays and the
// excluded day/date/range/pattern sets), storing single dates as yy/mm/dd and ranges as
// YYYYMMDD000000-YYYYMMDD000000. Range mode enforces the min/max nights.
function DatePicker({ field, value, onChange }: {
	field: ProductField;
	value: string;
	onChange: (value: string) => void;
}) {
	const t = useT();
	const cfg = field.datepicker;
	const disabled = (isoDay: string) => isDateDisabled(isoDay, cfg);

	if (cfg?.range) return <RangePicker cfg={cfg} value={value} onChange={onChange} disabled={disabled} t={t} />;

	const cur = hikaDateToIso(value);
	return (
		<div>
			<div className="hk-cal-value">{cur || t('field.pickDate')}</div>
			<DateCalendar isDisabled={disabled} selected={cur ? [cur] : []} openOn={cur}
				onPick={(d) => onChange(d === cur ? '' : isoToHikaDate(d))} />
		</div>
	);
}

function RangePicker({ cfg, value, onChange, disabled, t }: {
	cfg: NonNullable<ProductField['datepicker']>;
	value: string;
	onChange: (value: string) => void;
	disabled: (iso: string) => boolean;
	t: ReturnType<typeof useT>;
}) {
	const initial = hikaToIsoRange(value);
	const [start, setStart] = useState(initial.start);
	const [end, setEnd] = useState(initial.end);
	const [warn, setWarn] = useState('');

	function commit(s: string, e: string) {
		setStart(s); setEnd(e);
		onChange(s && e ? isoRangeToHika(s, e) : '');
	}
	function pick(d: string) {
		setWarn('');
		// First click, or restarting after a complete range, sets the start.
		if (!start || (start && end)) { commit(d, ''); return; }
		if (d < start) { commit(d, ''); return; }
		const nights = nightsBetween(start, d);
		if (cfg.range_min_nights && nights < cfg.range_min_nights) { setWarn('min'); return; }
		if (cfg.range_max_nights && nights > cfg.range_max_nights) { setWarn('max'); return; }
		commit(start, d);
	}
	const inRange = (d: string) => !!start && !!end && d > start && d < end;

	return (
		<div>
			<div className="hk-cal-value">{start ? `${start} → ${end || '…'}` : t('field.pickRange')}</div>
			<DateCalendar isDisabled={disabled} selected={[start, end].filter(Boolean)} inRange={inRange} openOn={start} onPick={pick} />
			{warn === 'min' && <span className="hk-err">{t('field.minNights', { count: cfg.range_min_nights })}</span>}
			{warn === 'max' && <span className="hk-err">{t('field.maxNights', { count: cfg.range_max_nights })}</span>}
		</div>
	);
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
						<Button block style={{ marginTop: 'var(--hk-s2)' }} disabled={busy} onClick={() => input.current?.click()}>
							<Icon name="plus" size={18} /> +
						</Button>
					)}
				</div>
			)}
			<input ref={input} type="file" accept={accept} multiple={field.multiple} hidden onChange={(e) => void pick(e.target.files)} />
		</div>
	);
}
