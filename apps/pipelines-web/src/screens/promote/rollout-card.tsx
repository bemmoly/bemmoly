import { formatDate, useFormatLocale, useT } from '@bemmoly/core-web';
import type { Deployment, RolloutWave } from '@bemmoly/module-pipelines/shared';
import { Radio, RolloutPlan, Switch } from '@bemmoly/ui';
import { useDeployments } from '../../hooks/use-shipping.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { Panel } from '../../parts/screen.tsx';
import { CanaryHealth } from './canary-health.tsx';
import { deploymentFor, stepsOf } from './plan-view.ts';
import type { PromoteView } from './use-promote.ts';

export interface RolloutChoice {
  /** A train departure to join, or "" for as soon as it is approved. */
  departure: string;
  autoRollback: boolean;
}

function useWaveWords() {
  const t = useT(pipelinesText);
  const locale = useFormatLocale();
  const list = (names: string[]) =>
    new Intl.ListFormat(locale, { type: 'conjunction' }).format(names);
  return {
    title: (wave: RolloutWave) =>
      wave.environments.length > 1
        ? t('pipelines.promote.waveTogether', {
            names: list(wave.environments.map((environment) => environment.name)),
          })
        : (wave.environments[0]?.name ?? ''),
    detail: (wave: RolloutWave) => {
      if (wave.startsAfter) {
        return t('pipelines.promote.waveAfter', {
          minutes: wave.startsAfter.bakeMinutes,
          wave: wave.startsAfter.wave,
        });
      }
      if (wave.steps.length === 0) return t('pipelines.promote.waveAtOnce');
      return t('pipelines.promote.waveSteps', { minutes: wave.steps[0]?.holdMinutes ?? 0 });
    },
  };
}

/**
 * How the release rolls across regions: waves of canary steps, the automatic roll back, and
 * when it goes (as soon as approved, or with a train). Once it is rolling, the same waves carry
 * their progress and the canary is judged against stable underneath.
 */
export function RolloutCard({
  view,
  choice,
  onChoice,
}: {
  view: PromoteView;
  choice: RolloutChoice;
  onChoice: (choice: RolloutChoice) => void;
}) {
  const t = useT(pipelinesText);
  const words = useWaveWords();
  const promotion = view.promotion;
  const live =
    promotion !== null &&
    ['rolling_out', 'succeeded', 'rolled_back', 'failed'].includes(promotion.state);
  const deployments =
    useDeployments({ application: view.application.key, limit: 50 }, live).data?.items ?? [];
  const deploymentOf = (wave: RolloutWave): Deployment | undefined =>
    promotion ? deploymentFor(wave, deployments, promotion.id) : undefined;
  const canary = deployments.find(
    (deployment) =>
      deployment.promotionId === promotion?.id &&
      (deployment.state === 'canary' ||
        deployment.state === 'waiting' ||
        deployment.phase === 'paused'),
  );
  const departsAt = (iso: string) => formatDate(iso, { hour: '2-digit', minute: '2-digit' });
  return (
    <Panel title={t('pipelines.promote.rollout')}>
      <RolloutPlan
        ariaLabel={t('pipelines.promote.rollout')}
        stateLabel={(state) => t(`pipelines.state.${state}`)}
        waves={view.plan.waves.map((wave) => ({
          key: String(wave.wave),
          number: wave.wave,
          title: words.title(wave),
          steps: stepsOf(wave, deploymentOf(wave)),
          detail: words.detail(wave),
        }))}
      >
        <label className="mt-2.5 flex items-center gap-2.5 text-13 text-tx">
          <Switch
            checked={promotion ? view.plan.autoRollback : choice.autoRollback}
            disabled={promotion !== null || view.plan.autoRollback}
            onCheckedChange={(autoRollback) => onChoice({ ...choice, autoRollback })}
            aria-label={t('pipelines.promote.autoRollback')}
          />
          {t('pipelines.promote.autoRollback')}
        </label>
      </RolloutPlan>
      {canary && <CanaryHealth deployment={canary} />}
      {!promotion && (
        <fieldset className="mt-4 flex flex-col gap-2">
          <legend className="mb-1.5 text-11 font-semibold text-tx-2">
            {t('pipelines.promote.when')}
          </legend>
          <Radio
            name="when"
            checked={choice.departure === ''}
            onChange={() => onChoice({ ...choice, departure: '' })}
            label={t('pipelines.promote.whenApproved')}
          />
          {view.departures.map((departure) => (
            <Radio
              key={departure.id}
              name="when"
              checked={choice.departure === departure.id}
              onChange={() => onChoice({ ...choice, departure: departure.id })}
              label={t('pipelines.promote.withTrain', {
                train: departure.trainName,
                time: departsAt(departure.departsAt),
              })}
              description={t('pipelines.promote.trainAboard', {
                count: departure.applicationCount,
              })}
            />
          ))}
        </fieldset>
      )}
      {promotion?.departure && (
        <p className="mt-3 text-12 text-tx-2">
          {t('pipelines.promote.onTrain', {
            train: promotion.departure.trainName,
            time: departsAt(promotion.departure.departsAt),
          })}
        </p>
      )}
    </Panel>
  );
}
