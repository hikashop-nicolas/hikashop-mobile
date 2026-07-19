import { useEffect, useRef } from 'react';

// A lightweight contenteditable HTML editor (no dependency): a small formatting
// toolbar over document.execCommand. Emits HTML, so it fits HikaShop's HTML
// descriptions and wysiwyg custom fields. Uncontrolled after mount to keep the caret.
export function RichText({ value, onChange, placeholder }: {
	value: string;
	onChange: (html: string) => void;
	placeholder?: string;
}) {
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
			<div className="hk-rte-bar" role="toolbar">
				<button type="button" onMouseDown={hold} onClick={() => exec('bold')} aria-label="bold"><b>B</b></button>
				<button type="button" onMouseDown={hold} onClick={() => exec('italic')} aria-label="italic"><i>I</i></button>
				<button type="button" onMouseDown={hold} onClick={() => exec('underline')} aria-label="underline"><u>U</u></button>
				<span className="hk-rte-sep" />
				<button type="button" onMouseDown={hold} onClick={() => exec('formatBlock', 'H3')} aria-label="heading">H</button>
				<button type="button" onMouseDown={hold} onClick={() => exec('insertUnorderedList')} aria-label="bullet list">&bull;</button>
				<button type="button" onMouseDown={hold} onClick={() => exec('insertOrderedList')} aria-label="numbered list">1.</button>
				<button type="button" onMouseDown={hold} onClick={link} aria-label="link">&#128279;</button>
				<span className="hk-rte-sep" />
				<button type="button" onMouseDown={hold} onClick={() => exec('removeFormat')} aria-label="clear formatting">T&#215;</button>
			</div>
			<div
				ref={ref}
				className="hk-rte-area"
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
