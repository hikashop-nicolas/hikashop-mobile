import { useEffect, useRef } from 'react';
import { useT } from '../i18n';

// A lightweight contenteditable HTML editor (no dependency): a small formatting
// toolbar over document.execCommand. Emits HTML, so it fits HikaShop's HTML
// descriptions and wysiwyg custom fields. Uncontrolled after mount to keep the caret.
export function RichText({ value, onChange, placeholder, label }: {
	value: string;
	onChange: (html: string) => void;
	placeholder?: string;
	// What this editor is for. It is a div with role="textbox", so without a name a screen
	// reader announces an editable area and nothing about what belongs in it. A Field cannot
	// label it either: its label attaches to native controls, and this is not one.
	label?: string;
}) {
	const t = useT();
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (el && el.innerHTML !== (value || '')) el.innerHTML = value || '';
		// Sync from props once on mount; later edits are user-driven to avoid caret jumps.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const emit = () => { if (ref.current) onChange(ref.current.innerHTML); };
	const exec = (cmd: string, arg?: string) => {
		ref.current?.focus();
		document.execCommand(cmd, false, arg);
		emit();
	};
	const link = () => {
		const url = window.prompt('URL', 'https://');
		if (url) exec('createLink', url);
	};

	// Keep the selection while clicking a toolbar button (prevent focus loss).
	const hold = (e: React.MouseEvent) => e.preventDefault();

	return (
		<div className="hk-rte">
			<div className="hk-rte-bar" role="toolbar" aria-label={t('rte.toolbar')}>
				<button type="button" onMouseDown={hold} onClick={() => exec('bold')} aria-label={t('rte.bold')}><b>B</b></button>
				<button type="button" onMouseDown={hold} onClick={() => exec('italic')} aria-label={t('rte.italic')}><i>I</i></button>
				<button type="button" onMouseDown={hold} onClick={() => exec('underline')} aria-label={t('rte.underline')}><u>U</u></button>
				<span className="hk-rte-sep" />
				<button type="button" onMouseDown={hold} onClick={() => exec('formatBlock', 'H3')} aria-label={t('rte.heading')}>H</button>
				<button type="button" onMouseDown={hold} onClick={() => exec('insertUnorderedList')} aria-label={t('rte.bulletList')}>&bull;</button>
				<button type="button" onMouseDown={hold} onClick={() => exec('insertOrderedList')} aria-label={t('rte.numberedList')}>1.</button>
				<button type="button" onMouseDown={hold} onClick={link} aria-label={t('rte.link')}>&#128279;</button>
				<span className="hk-rte-sep" />
				<button type="button" onMouseDown={hold} onClick={() => exec('removeFormat')} aria-label={t('rte.clearFormatting')}>T&#215;</button>
			</div>
			<div
				ref={ref}
				className="hk-rte-area"
				aria-label={label}
				contentEditable
				role="textbox"
				aria-multiline="true"
				data-placeholder={placeholder}
				onInput={emit}
				onBlur={emit}
				suppressContentEditableWarning
			/>
		</div>
	);
}
