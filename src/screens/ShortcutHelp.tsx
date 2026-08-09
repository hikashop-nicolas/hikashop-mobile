import { Modal } from '../ui';
import { useT } from '../i18n';
import { useShortcutHelp } from '../app/use-shortcuts';

// The list of shortcuts, on "?". A shortcut nobody can find is a shortcut nobody uses, and this
// is the one place where the app tells you they exist.
export function ShortcutHelp() {
	const t = useT();
	const { helpOpen, setHelpOpen, shortcuts } = useShortcutHelp();
	if (!helpOpen) return null;

	const groups: { key: 'go' | 'act' | 'help'; title: string }[] = [
		{ key: 'go', title: t('shortcut.groupGo') },
		{ key: 'act', title: t('shortcut.groupAct') },
		{ key: 'help', title: t('shortcut.groupHelp') },
	];

	return (
		<Modal title={t('shortcut.title')} onClose={() => setHelpOpen(false)}>
			{groups.map((g) => (
				<div key={g.key} className="hk-keys-group">
					<h3 className="hk-keys-title">{g.title}</h3>
					{shortcuts.filter((s) => s.group === g.key).map((s) => (
						<div key={s.keys} className="hk-keys-row">
							<span>{t(s.label)}</span>
							<span className="hk-keys">
								{s.keys.split(' ').map((k) => (
									<kbd key={k} className="hk-kbd">{k === 'Escape' ? 'Esc' : k}</kbd>
								))}
							</span>
						</div>
					))}
				</div>
			))}
			<p className="hk-keys-note">{t('shortcut.note')}</p>
		</Modal>
	);
}
