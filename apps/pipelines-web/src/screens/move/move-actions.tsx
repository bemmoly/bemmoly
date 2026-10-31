import { useT } from '@bemmoly/core-web';
import type { RuntimeMove } from '@bemmoly/module-pipelines/shared';
import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { MoveVerb } from '../../api/front-doors.ts';
import { pipelinesText } from '../../i18n/catalog.ts';

/**
 * Start, Pause, Continue and Roll back, only those the move's state allows. A plan nobody
 * started is cancelled with the same verb as a roll back, since nothing moved yet.
 */
export function MoveActions({
  move,
  busy,
  onAct,
}: {
  move: RuntimeMove;
  busy: MoveVerb | null;
  onAct: (verb: MoveVerb) => void;
}) {
  const t = useT(pipelinesText);
  const button = (verb: MoveVerb, label: string, variant: 'primary' | 'secondary' | 'ghost') => (
    <Button
      key={verb}
      variant={variant}
      loading={busy === verb}
      disabled={busy !== null && busy !== verb}
      onClick={() => onAct(verb)}
      className={verb === 'rollback' && move.state !== 'planned' ? 'text-red-tx' : undefined}
    >
      {verb === 'rollback' && move.state !== 'planned' && <Icon name="undo" size={14} />}
      {label}
    </Button>
  );
  return (
    <>
      {move.can.rollBack &&
        button(
          'rollback',
          move.state === 'planned' ? t('pipelines.move.cancel') : t('pipelines.move.rollBack'),
          'ghost',
        )}
      {move.can.pause && button('pause', t('pipelines.move.pause'), 'secondary')}
      {move.can.continue && button('continue', t('pipelines.move.continue'), 'primary')}
      {move.can.start && button('start', t('pipelines.move.start'), 'primary')}
    </>
  );
}
