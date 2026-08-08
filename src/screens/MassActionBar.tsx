import { useT, tError } from '../i18n';
import { Button, Icon } from '../ui';
import type { useMassActions } from '../app/use-massactions';

// The bar a listing shows while rows are being picked: how many are chosen, and the shop's own
// operations to run over them. The names come from the shop, so this says nothing about what any
// of them do beyond what the merchant called it.
export function MassActionBar({ state }: { state: ReturnType<typeof useMassActions> }) {
	const t = useT();
	const { actions, chosen, clear, run, busy, error, report, setReport } = state;

	return (
		<div className="hk-massbar">
			<div className="hk-massbar-head">
				<span className="hk-row-title hk-row-grow">{t('mass.selected', { count: chosen.size })}</span>
				<Button size="sm" onClick={clear}><Icon name="close" size={15} /> {t('common.cancel')}</Button>
			</div>
			<div className="hk-massbar-acts">
				{actions.map((a) => (
					<Button key={a.id} size="sm" variant="pri" disabled={busy || chosen.size === 0}
						title={a.description || undefined}
						onClick={() => void run(a)}>
						{a.name}
					</Button>
				))}
			</div>
			{/* An action that holds a step this operator may not run would do less than its name
			    says, so it is said before it is run rather than after. */}
			{actions.some((a) => a.restricted) && <div className="hk-row-sub">{t('mass.restricted')}</div>}
			{error && <div className="hk-error-note">{tError(t, error)}</div>}
			{report && (
				<div className="hk-massbar-report">
					<div className="hk-row-title">{t('mass.done')}</div>
					{report.map((line, i) => <div key={i} className="hk-row-sub">{line}</div>)}
					<Button size="sm" onClick={() => setReport(null)}>{t('common.done')}</Button>
				</div>
			)}
		</div>
	);
}
