import { useCallback, useEffect, useState } from 'react';
import { useUnsaved } from '../app/unsaved';
import { useT } from '../i18n';
import { Modal } from './layout';
import { Button } from './atoms';
import { Icon } from './icons';

// The one "you have unsaved changes" dialog, mounted by the shell so everything that leaves a
// form shares it: the list beside it in a split view, and the form's own back button. Registers
// itself as the thing that asks, so callers only have to say what leaving would do.
export function UnsavedPrompt() {
	const { setAsker } = useUnsaved();
	const t = useT();
	const [leave, setLeave] = useState<(() => void) | null>(null);

	const ask = useCallback((onLeave: () => void) => {
		// Stored in state, so it is wrapped: a bare function would be taken for an updater.
		setLeave(() => onLeave);
	}, []);

	useEffect(() => {
		setAsker(ask);
		return () => setAsker(null);
	}, [setAsker, ask]);

	if (!leave) return null;

	return (
		<Modal
			title={t('unsaved.title')}
			onClose={() => setLeave(null)}
			footer={<>
				<Button onClick={() => setLeave(null)}><Icon name="edit" size={16} /> {t('unsaved.stay')}</Button>
				<Button variant="danger" onClick={() => { const go = leave; setLeave(null); go(); }}><Icon name="trash" size={16} /> 
					{t('unsaved.discard')}
				</Button>
			</>}
		>
			<p>{t('unsaved.body')}</p>
		</Modal>
	);
}
