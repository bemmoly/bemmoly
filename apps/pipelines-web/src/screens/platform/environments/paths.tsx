import { useT } from '@bemmoly/core-web';
import type {
  Environment,
  EnvironmentPath,
  PathStep,
  Tier,
} from '@bemmoly/module-pipelines/shared';
import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Fragment, useState } from 'react';
import { TIERS } from '../../../hooks/use-environments.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { TierChip } from '../../../parts/tier-chip.tsx';
import { PathDialog } from './path-dialog.tsx';

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

/**
 * Each tier's path: the stages a release passes, what moves it on and how long it bakes.
 * Every tier is listed, with or without a path, so each can be set with Edit path.
 */
export function Paths({
  paths,
  environments,
}: {
  paths: readonly EnvironmentPath[];
  environments: readonly Environment[];
}) {
  const t = useT(pipelinesText);
  const [editing, setEditing] = useState<Tier | null>(null);
  return (
    <>
      <p className="text-12 text-tx-3">{t('pipelines.environments.tiersExplained')}</p>
      <ul className="flex flex-col">
        {TIERS.map((tier) => {
          const path = paths.find((item) => item.tier === tier);
          const stages = path ? stagesOf(path) : [];
          const name = path?.name ?? t(`pipelines.tier.${tier}`);
          return (
            <li
              key={tier}
              className="flex flex-col gap-2 border-b border-line-2 py-3 last:border-b-0 md:flex-row md:items-center"
            >
              <span className="flex w-32 shrink-0 items-center gap-2 text-13 font-medium text-tx">
                <TierChip tier={tier} />
                {name}
              </span>
              {stages.length === 0 ? (
                <p className="min-w-0 flex-1 text-13 text-tx-3">
                  {t('pipelines.environments.noPaths')}
                </p>
              ) : (
                <ol
                  aria-label={t('pipelines.environments.pathLabel', { name })}
                  className="flex min-w-0 flex-1 items-center overflow-x-auto pb-1"
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
              )}
              <Button
                size="xs"
                variant="secondary"
                className="self-start md:self-center"
                disabled={environments.length === 0}
                aria-label={t('pipelines.environments.editPathOf', { name })}
                onClick={() => setEditing(tier)}
              >
                {t('pipelines.environments.editPath')}
              </Button>
            </li>
          );
        })}
      </ul>
      {editing !== null && (
        <PathDialog
          tier={editing}
          path={paths.find((item) => item.tier === editing)}
          environments={environments}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
