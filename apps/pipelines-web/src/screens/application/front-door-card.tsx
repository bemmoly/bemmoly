import { useT } from '@bemmoly/core-web';
import type { FrontDoorRoute } from '@bemmoly/module-pipelines/shared';
import { Skeleton } from '@bemmoly/ui';
import { useFrontDoors } from '../../hooks/use-front-doors.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { RUNTIME_NAME } from '../../parts/runtime-words.ts';
import { SIDE_CARD } from './side-cards.tsx';

/**
 * The front door: where callers reach the application in each environment that has one, and
 * how its traffic is split between runtimes now. During a move both runtimes show here.
 */
export function FrontDoorCard({ application }: { application: string }) {
  const t = useT(pipelinesText);
  const doors = useFrontDoors(application);
  const routed = (doors.data?.items ?? []).flatMap((door) =>
    door.routes.map((route) => ({ environment: door.environment, route })),
  );
  const split = (route: FrontDoorRoute) =>
    [...route.backends]
      .filter((backend) => backend.percent > 0)
      .sort((a, b) => b.percent - a.percent)
      .map((backend) =>
        t('pipelines.frontDoor.share', {
          runtime: t(RUNTIME_NAME[backend.runtime]),
          percent: backend.percent,
        }),
      )
      .join(', ');
  return (
    <section className={SIDE_CARD} aria-labelledby="front-door-heading">
      <h2 id="front-door-heading" className="text-16 leading-title font-semibold text-tx">
        {t('pipelines.frontDoor.title')}
      </h2>
      {doors.isError ? (
        <LoadFailed bare size="sm" error={doors.error} onRetry={() => void doors.refetch()} />
      ) : !doors.data ? (
        <Skeleton width="60%" height={12} />
      ) : routed.length === 0 ? (
        <p className="text-12 leading-body text-tx-2">
          {t('pipelines.frontDoor.none', { application })}
        </p>
      ) : (
        <dl className="flex flex-col gap-2">
          {routed.map(({ environment, route }) => (
            <div key={environment.id} className="flex min-w-0 flex-col gap-0.5 text-12">
              <dt className="text-tx-3">{environment.name}</dt>
              <dd className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-tx">
                  {route.url ?? t('pipelines.frontDoor.noAddress')}
                </span>
                {route.url?.startsWith('http://') && (
                  <span className="text-tx-3">
                    {t('pipelines.frontDoor.hostHeader', { host: route.host })}
                  </span>
                )}
                <span className="text-tx-2">{split(route)}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
