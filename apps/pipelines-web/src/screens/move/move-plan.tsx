import { useT } from '@bemmoly/core-web';
import type { RuntimeMove } from '@bemmoly/module-pipelines/shared';
import { RolloutPlan } from '@bemmoly/ui';
import { pipelinesText } from '../../i18n/catalog.ts';
import { RUNTIME_NAME } from '../../parts/runtime-words.ts';
import { Panel } from '../../parts/screen.tsx';
import { stepGlyph } from './words.ts';

/**
 * The steps of a move as three waves: deploy on the new runtime and wait until it is healthy,
 * shift traffic in steps each judged against the old runtime, then hold and remove the old
 * one. Before the move it is the plan; during it each step carries its glyph.
 */
export function MovePlan({ move }: { move: RuntimeMove }) {
  const t = useT(pipelinesText);
  const from = t(RUNTIME_NAME[move.from]);
  const to = t(RUNTIME_NAME[move.to]);
  const hold = move.steps[0]?.holdMinutes ?? 0;
  return (
    <Panel title={t('pipelines.move.steps')}>
      <RolloutPlan
        ariaLabel={t('pipelines.move.steps')}
        stateLabel={(state) => t(`pipelines.state.${state}`)}
        waves={[
          {
            key: 'deploy',
            number: 1,
            title: t('pipelines.move.stepDeploy', { runtime: to }),
            detail: move.release
              ? t('pipelines.move.stepDeployDetail', { version: move.release.version })
              : t('pipelines.move.stepDeployNothing'),
          },
          {
            key: 'shift',
            number: 2,
            title: t('pipelines.move.stepShift', { runtime: to }),
            steps: move.steps.map((step) => ({
              key: String(step.percent),
              label: `${step.percent}%`,
              state: stepGlyph(step, move),
            })),
            detail: t('pipelines.move.stepShiftDetail', { minutes: hold, runtime: from }),
          },
          {
            key: 'remove',
            number: 3,
            title: t('pipelines.move.stepRemove', { runtime: from }),
            detail: t('pipelines.move.stepRemoveDetail', { minutes: hold }),
          },
        ]}
      />
    </Panel>
  );
}

/** What callers see during the move: nothing changes for them. */
export function MoveDowntime({ move }: { move: RuntimeMove }) {
  const t = useT(pipelinesText);
  const from = t(RUNTIME_NAME[move.from]);
  return (
    <Panel title={t('pipelines.move.downtime')}>
      <p className="text-16 leading-title font-semibold text-tx">
        {move.downtime === 'none'
          ? t('pipelines.move.downtimeNone')
          : t('pipelines.move.downtimeAddress')}
      </p>
      {move.frontDoor && (
        <p className="text-13 leading-body text-tx-2">
          {t('pipelines.move.downtimeKeep', {
            address: move.frontDoor.url ?? move.frontDoor.host,
            runtime: from,
          })}
        </p>
      )}
    </Panel>
  );
}

/** What has only met a simulation or a recording, and what a person does by hand. */
export function MoveUntested({ move }: { move: RuntimeMove }) {
  const t = useT(pipelinesText);
  return (
    <Panel title={t('pipelines.move.untested')}>
      <ul className="flex list-disc flex-col gap-1.5 ps-4 text-13 leading-body text-tx-2">
        {move.untested.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {move.byHand.length > 0 && (
        <>
          <h3 className="mt-3 text-13 font-semibold text-tx">{t('pipelines.move.byHand')}</h3>
          <ul className="flex list-disc flex-col gap-1.5 ps-4 text-13 leading-body text-tx-2">
            {move.byHand.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
