import { useT } from '@bemmoly/core-web';
import { Button, EmptyState, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { Fragment } from 'react';
import { servicesText } from '../../i18n/catalog.ts';
import { useDeployOrPromote } from '../../parts/deploy-or-promote.tsx';
import { RunLine, RunLinesSkeleton } from '../../parts/run-line.tsx';
import { CARD } from './card.ts';
import { EnvironmentCard } from './environment-card.tsx';
import { useService, useServiceKey, useServiceRuns } from './use-service.ts';

/**
 * Overview: the lane of environments in path order, each with what runs there, an arrow
 * between them that promotes to the next, then the service's recent runs and its pipelines.
 */
export default function ServiceOverview() {
  const t = useT(servicesText);
  const key = useServiceKey();
  const service = useService(key);
  const runs = useServiceRuns(key, 5);
  const deploy = useDeployOrPromote();
  const data = service.data;
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      {!data ? (
        <div aria-busy className="flex gap-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className={`${CARD} flex-1`}>
              <Skeleton width={80} height={12} />
              <Skeleton width={120} height={20} />
              <Skeleton width="70%" height={10} />
            </div>
          ))}
        </div>
      ) : data.environments.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            icon={<Icon name="layers" size={18} />}
            title={t('pipelinesServices.overview.noEnvironments')}
            description={t('pipelinesServices.overview.noEnvironmentsHint')}
            action={
              <Link to="/environments" className="text-13 text-acc focus-ring">
                {t('pipelinesServices.overview.addEnvironments')}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="-m-1 overflow-x-auto p-1">
          <ol
            aria-label={t('pipelinesServices.overview.lane')}
            className="flex items-stretch gap-2"
          >
            {data.environments.map((environment, index) => (
              <Fragment key={environment.key}>
                {index > 0 ? (
                  <li className="flex shrink-0 items-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      tight
                      aria-label={t('pipelinesServices.overview.promoteTo', {
                        environment: environment.name,
                      })}
                      icon={<Icon name="arrow-right" size={14} className="rtl:-scale-x-100" />}
                      onClick={() => deploy.open({ service: key, environment: environment.key })}
                    />
                  </li>
                ) : null}
                <li className="flex min-w-56 flex-1 basis-0">
                  <EnvironmentCard
                    service={key}
                    environment={environment}
                    running={data.service.running.find(
                      (running) => running.environment === environment.key,
                    )}
                    onDeploy={() => deploy.open({ service: key, environment: environment.key })}
                  />
                </li>
              </Fragment>
            ))}
          </ol>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <section className={CARD} aria-labelledby="recent-runs">
          <div className="flex items-center gap-2">
            <h2 id="recent-runs" className="text-14 font-semibold text-tx">
              {t('pipelinesServices.overview.recentRuns')}
            </h2>
            <Link
              to="/services/$key/runs"
              params={{ key }}
              className="ms-auto text-12 text-acc focus-ring"
            >
              {t('pipelinesServices.overview.allRuns')}
            </Link>
          </div>
          {runs.data ? (
            runs.data.items.length ? (
              <ul className="flex flex-col">
                {runs.data.items.map((run) => (
                  <RunLine key={run.id} run={run} />
                ))}
              </ul>
            ) : (
              <span className="text-13 text-tx-3">{t('pipelinesServices.runs.empty')}</span>
            )
          ) : (
            <RunLinesSkeleton />
          )}
        </section>
        <section className={CARD} aria-labelledby="pipelines-card">
          <div className="flex items-center gap-2">
            <h2 id="pipelines-card" className="text-14 font-semibold text-tx">
              {t('pipelinesServices.tab.pipelines')}
            </h2>
            <Link
              to="/services/$key/pipelines"
              params={{ key }}
              className="ms-auto text-12 text-acc focus-ring"
            >
              {t('pipelinesServices.overview.openPipelines')}
            </Link>
          </div>
          <p className="text-13 text-tx-3">{t('pipelinesServices.overview.pipelinesHint')}</p>
        </section>
      </div>
      {deploy.dialog}
    </div>
  );
}
