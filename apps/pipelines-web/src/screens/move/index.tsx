import { useT } from '@bemmoly/core-web';
import { Button, RunGlyph, SkeletonCard } from '@bemmoly/ui';
import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import type { MoveVerb } from '../../api/front-doors.ts';
import { useGo } from '../../hooks/use-go.ts';
import { useMove, useMoveAction } from '../../hooks/use-front-doors.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { ActionError } from '../../parts/action-error.tsx';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { RUNTIME_NAME } from '../../parts/runtime-words.ts';
import { Screen } from '../../parts/screen.tsx';
import { MoveActions } from './move-actions.tsx';
import { MoveCost } from './move-cost.tsx';
import { MoveDowntime, MovePlan, MoveUntested } from './move-plan.tsx';
import { MOVE_GLYPH } from './words.ts';

/**
 * A runtime move: its steps, its downtime, what it costs a month and what is untested come
 * first, then where it is now and what can be done about it. Start, Pause, Continue and Roll
 * back sit in the header; the screen follows the move every few seconds while it runs.
 */
export default function MoveScreen() {
  const t = useT(pipelinesText);
  const go = useGo();
  const { key = '', id = '' } = useParams({ strict: false }) as { key?: string; id?: string };
  const move = useMove(id);
  const act = useMoveAction(id, key);
  const [verb, setVerb] = useState<MoveVerb | null>(null);
  const view = move.data;
  const title = view
    ? t('pipelines.move.title', {
        application: view.application.name,
        runtime: t(RUNTIME_NAME[view.to]),
      })
    : t('pipelines.move.loading');
  const onAct = (next: MoveVerb) => {
    setVerb(next);
    act.mutate(next, { onSettled: () => setVerb(null) });
  };
  return (
    <Screen
      title={title}
      meta={
        view && (
          <span className="flex items-center gap-2 text-tx-2">
            {view.environment.name}
            <RunGlyph state={MOVE_GLYPH[view.state]} size={14} />
            {t(`pipelines.move.state.${view.state}`, { percent: view.percent })}
          </span>
        )
      }
      actions={
        <>
          <Button variant="ghost" onClick={() => go({ to: `/applications/${key}` })}>
            {t('pipelines.move.back')}
          </Button>
          {view && <MoveActions move={view} busy={verb} onAct={onAct} />}
        </>
      }
    >
      {move.isError && !view ? (
        <LoadFailed error={move.error} onRetry={() => void move.refetch()} />
      ) : !view ? (
        <div aria-busy className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          {view.message && (
            <p role="status" className="text-13 text-tx-2">
              {view.message}
            </p>
          )}
          <ActionError error={act.error} />
          <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
            <MovePlan move={view} />
            <MoveDowntime move={view} />
            <MoveCost move={view} />
            <MoveUntested move={view} />
          </div>
        </>
      )}
    </Screen>
  );
}
