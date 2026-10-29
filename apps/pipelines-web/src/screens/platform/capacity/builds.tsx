import { useT } from '@bemmoly/core-web';
import type { PoolMachine, RunnerPool } from '@bemmoly/module-pipelines/shared';
import { RelativeTime, RunGlyph } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { pipelinesText } from '../../../i18n/catalog.ts';

/**
 * Builds now: every machine Pipelines started that is still starting or running (a Cloud
 * Build build or a GKE Autopilot pod), with its pool, the job it is for and where Google shows
 * it. A pool's machines end with their jobs, so an idle pool lists nothing here and costs
 * nothing.
 */
export function Builds({ pools }: { pools: readonly RunnerPool[] }) {
  const t = useT(pipelinesText);
  const rows = pools.flatMap((pool) =>
    pool.machines.map((machine) => ({ pool, machine })),
  ) satisfies Array<{ pool: RunnerPool; machine: PoolMachine }>;
  if (rows.length === 0) {
    return <p className="px-4 pb-4 text-13 text-tx-3">{t('pipelines.capacity.buildsEmpty')}</p>;
  }
  return (
    <ul className="flex flex-col px-4 pb-2" aria-label={t('pipelines.capacity.buildsLabel')}>
      {rows.map(({ pool, machine }) => (
        <li
          key={machine.id}
          className="flex items-center gap-2 border-b border-line-2 py-1.75 text-12 last:border-b-0"
        >
          <RunGlyph
            state={machine.state === 'running' ? 'running' : 'queued'}
            size={14}
            label={t(
              `pipelines.capacity.machine.${machine.state === 'running' ? 'running' : 'starting'}`,
            )}
          />
          <Link
            to="/runs/$id"
            params={{ id: machine.runId }}
            className="min-w-0 shrink truncate font-medium text-tx hover:text-acc"
          >
            {machine.what}
          </Link>
          <span className="hidden shrink-0 text-tx-3 sm:inline">{pool.name}</span>
          <span className="ms-auto shrink-0 text-tx-3">
            <RelativeTime iso={machine.startedAt} />
          </span>
          {machine.logUrl ? (
            <a
              href={machine.logUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-tx-2 hover:text-acc"
            >
              {pool.hosting === 'gke-autopilot'
                ? t('pipelines.capacity.podLink')
                : t('pipelines.capacity.buildLog')}
            </a>
          ) : (
            <span className="shrink-0 text-tx-3">{t('pipelines.capacity.machine.starting')}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
