import { useT } from '../i18n';
import { Icon } from './icons';

// Whether a record is on sale, and the control that changes it, in one mark. A listing row can
// already be deleted through its form; this is the smaller decision, and it is the one worth
// making without opening anything.
//
// It lives inside rows that are themselves links, so a click here must not also follow the row.
export function PublishToggle({ published, busy, onToggle }: {
	published: boolean;
	busy?: boolean;
	onToggle: () => void;
}) {
	const t = useT();
	const label = published ? t('common.unpublish') : t('common.publish');
	return (
		<button
			type="button"
			className={`hk-pub${published ? ' hk-on' : ''}`}
			disabled={busy}
			title={label}
			aria-label={label}
			aria-pressed={published}
			onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
		>
			<Icon name={published ? 'check' : 'close'} size={14} />
		</button>
	);
}
