import { useT } from '@bemmoly/core-web';
import { deployRuntimeSchema, type ApplicationRuntime } from '@bemmoly/module-pipelines/shared';
import { Select, Skeleton } from '@bemmoly/ui';
import { useApplicationRuntimes, useSetRuntime } from '../../hooks/use-runtimes.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { RUNTIME_NAME } from '../../parts/runtime-words.ts';
import { ActionError } from '../../parts/action-error.tsx';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { SIDE_CARD } from './side-cards.tsx';

const FOLLOW = 'follow';

/**
 * Where it runs: the runtime in each environment, switched here without a commit. "Default"
 * follows application.yaml, then the environment. A switch takes effect on the next deploy;
 * when that deploy would fail (no cluster, the wrong kind) the reason shows under it.
 */
export function RuntimeCard({ application }: { application: string }) {
  const t = useT(pipelinesText);
  const runtimes = useApplicationRuntimes(application);
  const set = useSetRuntime(application);
  const name = (runtime: ApplicationRuntime['runtime']) => t(RUNTIME_NAME[runtime]);
  const followLabel = (item: ApplicationRuntime) =>
    item.file
      ? t('pipelines.runtimes.followFile', { runtime: name(item.file) })
      : t('pipelines.runtimes.followEnvironment', { runtime: name(item.environmentDefault) });
  return (
    <section className={SIDE_CARD} aria-labelledby="runtime-heading">
      <h2 id="runtime-heading" className="text-16 leading-title font-semibold text-tx">
        {t('pipelines.runtimes.title')}
      </h2>
      {runtimes.isError ? (
        <LoadFailed bare size="sm" error={runtimes.error} onRetry={() => void runtimes.refetch()} />
      ) : !runtimes.data ? (
        <Skeleton width="70%" height={12} />
      ) : (
        <>
          <dl className="flex flex-col gap-2">
            {runtimes.data.items.map((item) => (
              <div key={item.environment.id} className="flex flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2 text-12">
                  <dt className="w-21 shrink-0 truncate text-tx-3">{item.environment.name}</dt>
                  <dd className="min-w-0 flex-1">
                    <Select
                      size="sm"
                      aria-label={t('pipelines.runtimes.selectLabel', {
                        env: item.environment.name,
                      })}
                      value={item.chosen ?? FOLLOW}
                      options={[
                        { value: FOLLOW, label: followLabel(item) },
                        ...deployRuntimeSchema.options.map((value) => ({
                          value,
                          label: name(value),
                        })),
                      ]}
                      onChange={(event) =>
                        set.mutate({
                          environment: item.environment.key,
                          runtime:
                            event.value === FOLLOW ? null : deployRuntimeSchema.parse(event.value),
                        })
                      }
                    />
                  </dd>
                </div>
                {item.problem && (
                  <p className="ps-23 text-12 leading-body text-amber-tx">{item.problem}</p>
                )}
              </div>
            ))}
          </dl>
          <p className="text-12 text-tx-3">{t('pipelines.runtimes.nextDeploy')}</p>
          <ActionError error={set.error} />
        </>
      )}
    </section>
  );
}
