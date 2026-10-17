import { useT } from '@bemmoly/core-web';
import type { EnvironmentPath, PathStep } from '@bemmoly/module-pipelines/shared';
import { Icon } from '@bemmoly/ui/icons';
import { Fragment } from 'react';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { TierChip } from '../../../parts/tier-chip.tsx';

/** Steps grouped by stage, in order: environments in one stage roll out together. */
export function stagesOf(path: EnvironmentPath): PathStep[][] {
  const stages = new Map<number, PathStep[]>();
  for (const step of path.steps) stages.set(step.stage, [...(stages.get(step.stage) ?? []), step]);
  return [...stages.entries()].sort(([a], [b]) => a - b).map(([, steps]) => steps);
}

function Arrow({ next }: { next: PathStep[] }) {
  const t = useT(pipelinesText);
  const step = next[0];
  if (!step) return null;
  return (
    <span className="flex shrink-0 flex-col items-center gap-0.5 px-1 text-11 text-tx-3">
      <Icon name="arrow-right" size={14} />
      <span className="whitespace-nowrap">
        {step.autoPromote ? t('pipelines.environments.auto') : t('pipelines.environments.promoted')}
      </span>
      {step.bakeMinutes > 0 && (
        <span className="whitespace-nowrap">
          {t('pipelines.environments.bake', { minutes: step.bakeMinutes })}
        </span>
      )}
    </span>
  );
}

/** Each tier's path: the stages a release passes, what moves it on and how long it bakes. */
export function Paths({ paths }: { paths: readonly EnvironmentPath[] }) {
  const t = useT(pipelinesText);
  if (paths.length === 0) {
    return <p className="text-13 text-tx-3">{t('pipelines.environments.noPaths')}</p>;
  }
  return (
    <ul className="flex flex-col">
      {paths.map((path) => {
        const stages = stagesOf(path);
        return (
          <li
            key={path.id}
            className="flex flex-col gap-2 border-b border-line-2 py-3 last:border-b-0 md:flex-row md:items-center"
          >
            <span className="flex w-32 shrink-0 items-center gap-2 text-13 font-medium text-tx">
              <TierChip tier={path.tier} />
              {path.name}
            </span>
            <ol
              aria-label={t('pipelines.environments.pathLabel', { name: path.name })}
              className="flex min-w-0 items-center overflow-x-auto pb-1"
            >
              {stages.map((steps, index) => (
                <Fragment key={steps[0]?.environment.id ?? index}>
                  {index > 0 && <Arrow next={steps} />}
                  <li className="flex shrink-0 flex-col gap-1">
                    {steps.map((step) => (
                      <span
                        key={step.environment.id}
                        className="flex items-center gap-1.5 rounded-control border border-line bg-card px-2.5 py-1 text-12 font-medium whitespace-nowrap text-tx"
                      >
                        {step.environment.class === 'prod' && (
                          <Icon name="shield" size={12} className="text-tx-2" />
                        )}
                        {step.environment.name}
                      </span>
                    ))}
                  </li>
                </Fragment>
              ))}
            </ol>
          </li>
        );
      })}
    </ul>
  );
}
