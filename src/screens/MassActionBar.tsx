import { useT, tError } from '../i18n';
import { Button, Icon } from '../ui';
import type { useMassActions } from '../app/use-massactions';

// A checkbox on a listing row, for picking what a bulk operation will run over.
//
// It sits beside the row's link rather than inside it. Inside, it would be interactive content
// nested in a link, and stopping the link from following would also stop the box from ticking:
// the browser's default action is one and the same click.
export function PickBox({ id, state, label }: { id: number; state: ReturnType<typeof useMassActions>; label: string }) {
	return (
		<input
			type="checkbox"
			className="hk-pickbox"
			checked={state.chosen.has(id)}
			aria-label={label}
			onChange={() => state.toggle(id)}
		/>
	);
}

// What the listing shows once something is ticked: how many, and the operations the merchant built
// for this kind of record. Their names are the shop's, so nothing here describes what they do.
export function MassActionBar({ state }: { state: ReturnType<typeof useMassActions> }) {
	const t = useT();
	const { actions, chosen, clear, run, busy, error, report, setReport } = state;

	// The shop said something back. Most actions say nothing and the reloaded listing is the
	// answer, so this only appears when there is something to read.
	if (report) {
		return (
			<div className="hk-massbar">
				{report.map((line, i) => <div key={i} className="hk-row-sub">{line}</div>)}
				<Button size="sm" style={{ alignSelf: 'flex-start' }} onClick={() => setReport(null)}>
					<Icon name="check" size={15} /> {t('common.done')}
				</Button>
			</div>
		);
	}

	if (chosen.size === 0) return null;

	return (
		<div className="hk-massbar">
			<div className="hk-massbar-head">
				<span className="hk-row-title hk-row-grow">{t('mass.selected', { count: chosen.size })}</span>
				<Button size="sm" onClick={clear}><Icon name="close" size={15} /> {t('mass.clear')}</Button>
			</div>
			<div className="hk-massbar-acts">
				{actions.map((a) => (
					<Button key={a.id} size="sm" variant="pri" disabled={busy}
						title={a.description || undefined}
						onClick={() => void run(a)}>
						{a.name}
					</Button>
				))}
			</div>
			{/* An action holding a step this operator may not run would do less than its name says,
			    so it is said before it is run rather than after. */}
			{actions.some((a) => a.restricted) && <div className="hk-row-sub">{t('mass.restricted')}</div>}
			{error && <div className="hk-error-note">{tError(t, error)}</div>}
		</div>
	);
}
