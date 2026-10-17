import { useT } from '@bemmoly/core-web';
import { Skeleton } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { pipelinesKeys } from '../../../api/pipelines.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { api } from '../../../lib/api.ts';
import { Area } from '../../../parts/area.tsx';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { Paths } from './paths.tsx';
import { EnvironmentsTable } from './table.tsx';

/**
 * Platform › Environments: the path each tier takes through the environments, and what each
 * environment asks of a deploy. Prod is marked with the shield and the word Protected.
 */
export default function EnvironmentsArea() {
  const t = useT(pipelinesText);
  const environments = useQuery({
    queryKey: pipelinesKeys.environments(),
    queryFn: () => api.pipelines.environments(),
  });
  const paths = useQuery({
    queryKey: [...pipelinesKeys.environments(), 'paths'],
    queryFn: () => api.pipelines.paths(),
  });
  return (
    <Area title={t('pipelines.platform.environments')} meta={t('pipelines.environments.intro')}>
      <Panel title={t('pipelines.environments.paths')}>
        {paths.isError ? (
          <LoadFailed bare size="sm" error={paths.error} onRetry={() => void paths.refetch()} />
        ) : !paths.data ? (
          <div aria-busy className="flex flex-col gap-3 py-2">
            <Skeleton height={28} />
            <Skeleton height={28} />
          </div>
        ) : (
          <Paths paths={paths.data.items} />
        )}
      </Panel>
      <Panel flush title={t('pipelines.platform.environments')}>
        {environments.isError ? (
          <LoadFailed
            bare
            size="sm"
            error={environments.error}
            onRetry={() => void environments.refetch()}
          />
        ) : !environments.data ? (
          <RowsSkeleton columns={3} rows={5} />
        ) : (
          <EnvironmentsTable items={environments.data.items} />
        )}
      </Panel>
    </Area>
  );
}
