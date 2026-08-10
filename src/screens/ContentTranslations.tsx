import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStores } from '../app/store-context';
import { useT, tError, LOCALES } from '../i18n';
import type { ContentTranslations as Payload, TranslationValues } from '../core';
import { Screen, Spinner, Icon, Field, Button, RichText } from '../ui';
import { useDataChanged } from '../app/data-changed';
import { useUnsavedChanges, useConfirmLeave } from '../app/unsaved';

// The merchant's own text in the shop's other languages, for one product or category. The
// shop decides what can be translated (its own columns, plus whatever custom fields the
// merchant flagged), so this screen renders what it is handed rather than a fixed form.

// HikaShop's column names, said the way the app already says them everywhere else. Anything
// not here falls back to the label the shop sent, which is how custom fields arrive.
const APP_LABEL: Record<string, string> = {
	product_name: 'product.name',
	product_description: 'product.description',
	product_page_title: 'product.pageTitle',
	product_url: 'product.urlRedirect',
	product_meta_description: 'product.metaDescription',
	product_keywords: 'product.keywords',
	product_alias: 'product.alias',
	product_canonical: 'product.canonical',
	category_name: 'category.name',
	category_description: 'category.description',
	category_product_page_info: 'category.pageInfo',
	category_page_title: 'product.pageTitle',
	category_meta_description: 'product.metaDescription',
	category_keywords: 'product.keywords',
	category_alias: 'product.alias',
	category_canonical: 'product.canonical',
};

// The original as a line of text: a description is HTML, and showing it raw would put tags and
// entities in front of the merchant. Parsed rather than stripped with a regular expression, so
// &amp; reads as & and not as itself. The parser builds a detached document, so nothing in the
// markup runs or loads.
function plainText(html: string): string {
	if (html === '' || !html.includes('<') && !html.includes('&')) return html.trim();
	const doc = new DOMParser().parseFromString(html, 'text/html');
	return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// A language's name in its own language when the app knows the tag, which it does for every
// language HikaShop is translated into. Otherwise the tag, which is better than nothing.
function languageName(code: string): string {
	return LOCALES[code]?.name ?? LOCALES[code.slice(0, 2)]?.name ?? code;
}

export function ContentTranslations({ type }: { type: 'products' | 'categories' }) {
	const { id } = useParams();
	const nav = useNavigate();
	const { client, active } = useStores();
	const confirmLeave = useConfirmLeave();
	const changed = useDataChanged();
	const t = useT();
	const recordId = Number(id);
	const back = type === 'products' ? `/products/${recordId}` : `/categories/${recordId}/edit`;

	const [payload, setPayload] = useState<Payload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [lang, setLang] = useState<string>('');
	const [values, setValues] = useState<TranslationValues>({});
	const [baseline, setBaseline] = useState('');
	const [busy, setBusy] = useState(false);
	const [saveErr, setSaveErr] = useState('');

	// Not cached: a translation is edited rarely and read once, and a stale copy here would
	// quietly overwrite what somebody changed in the website backend.
	useEffect(() => {
		if (!client || !active || !id) return;
		let alive = true;
		void (async () => {
			try {
				const d = await client.getContentTranslations(type, recordId);
				if (!alive) return;
				setPayload(d);
				setValues(d.values ?? {});
				setBaseline(JSON.stringify(d.values ?? {}));
				// Never the shop's own language: typing a French name into the English slot is
				// silent and wrong, and the shop sends that language last for the same reason.
				const first = d.languages.find((l) => !l.site_default) ?? d.languages[0];
				setLang(String(first?.id ?? ''));
			} catch (e) {
				const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
				if (alive) setError(code);
			}
		})();
		return () => { alive = false; };
	}, [client, active, id, type, recordId]);

	const dirty = JSON.stringify(values) !== baseline;
	useUnsavedChanges(payload !== null && baseline !== '' && dirty);

	const columns = useMemo(() => payload?.columns ?? [], [payload]);

	function set(column: string, text: string) {
		setValues((v) => ({ ...v, [lang]: { ...(v[lang] ?? {}), [column]: text } }));
	}

	async function save() {
		if (!client || !payload) return;
		setBusy(true);
		setSaveErr('');
		try {
			// Only the languages that changed, so a save never rewrites text somebody else edited
			// in another language in the meantime.
			const before = JSON.parse(baseline || '{}') as TranslationValues;
			const out: TranslationValues = {};
			for (const [lg, fields] of Object.entries(values)) {
				if (JSON.stringify(fields) !== JSON.stringify(before[lg] ?? {})) out[lg] = fields;
			}
			await client.setContentTranslations(type, recordId, out);
			setBaseline(JSON.stringify(values));
			changed.bump(type === 'products' ? 'products' : 'categories');
			nav(back);
		} catch (e) {
			const code = (e && typeof e === 'object' && typeof (e as { code?: unknown }).code === 'string') ? (e as { code: string }).code : 'generic';
			setSaveErr(tError(t, code));
		} finally {
			setBusy(false);
		}
	}

	const current = values[lang] ?? {};
	// Which originals are shown in full. A description can run for paragraphs, so it is kept to a
	// couple of lines and opens on a tap: on a phone there is no hovering to read a title.
	const [shown, setShown] = useState<Record<string, boolean>>({});

	return (
		<Screen
			title={t('translations.title')}
			left={<button className="hk-iconbtn" onClick={() => confirmLeave(() => nav(back))} aria-label={t('common.back')}><Icon name="back" size={24} /></button>}
			right={payload?.enabled ? <Button variant="pri" size="sm" disabled={busy || !dirty} onClick={() => void save()}><Icon name="save" size={16} /> {busy ? t('product.saving') : t('common.save')}</Button> : undefined}
		>
			{error ? (
				<div className="hk-error-note">{tError(t, error)}</div>
			) : !payload ? (
				<div className="hk-center-col"><Spinner /></div>
			) : !payload.enabled ? (
				<div className="hk-card hk-card--pad hk-muted">{t('translations.disabled')}</div>
			) : (
				<>
					{saveErr && <div className="hk-error-note">{saveErr}</div>}
					<div className="hk-card hk-card--pad">
						<div className="hk-chiprow" style={{ display: 'flex', gap: 'var(--hk-s2)', flexWrap: 'wrap' }} role="tablist" aria-label={t('translations.language')}>
							{payload.languages.map((l) => (
								<button
									key={l.id}
									role="tab"
									aria-selected={String(l.id) === lang}
									className={`hk-chip${String(l.id) === lang ? ' hk-on' : ''}`}
									onClick={() => setLang(String(l.id))}
								>{languageName(l.code)}{l.site_default ? ` (${t('translations.shopLanguage')})` : ''}</button>
							))}
						</div>
					</div>

					{columns.map((c) => {
						const label = APP_LABEL[c.name] ? t(APP_LABEL[c.name]) : (c.label || c.name);
						const original = payload.original[c.name] ?? '';
						const value = current[c.name] ?? '';
						const from = plainText(original);
						return (
							<div className="hk-card hk-card--pad hk-form" key={c.name}>
								<Field label={label}>
									{c.type === 'html' ? (
										<RichText value={value} onChange={(html) => set(c.name, html)} label={label} />
									) : c.type === 'multiline' ? (
										<textarea className="hk-input" rows={3} value={value} onChange={(e) => set(c.name, e.target.value)} />
									) : (
										<input className="hk-input" value={value} onChange={(e) => set(c.name, e.target.value)} />
									)}
								</Field>
								{from !== '' && (
									<button
										type="button"
										className={`hk-orig${shown[c.name] ? ' hk-orig--open' : ''}`}
										aria-expanded={!!shown[c.name]}
										onClick={() => setShown((v) => ({ ...v, [c.name]: !v[c.name] }))}
									>
										<span className="hk-orig-label">{t('translations.original')}:</span> {from}
									</button>
								)}
							</div>
						);
					})}
				</>
			)}
		</Screen>
	);
}
