import { useT } from '@bemmoly/core-web';
import type { Environment } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useAllCloudAccounts } from '../../../hooks/use-clouds.ts';
import { useEnvironmentPaths, useEnvironments } from '../../../hooks/use-environments.ts';
import { useGo } from '../../../hooks/use-go.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { Area } from '../../../parts/area.tsx';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { ArchiveConfirm } from './archive-confirm.tsx';
import { groupReadyAccounts } from './draft.ts';
import { EnvironmentDialog } from './environment-dialog.tsx';
import { Paths } from './paths.tsx';
import { EnvironmentsTable } from './table.tsx';

/**
 * Platform › Environments: the path each tier takes through the environments, and what each
 * environment asks of a deploy. Prod is marked with the shield and the word Protected.
 * Environments are created here, each in a ready project, and edited or archived from their
 * row; a fresh install starts on the empty state, which says why they are needed.
 */
export default function EnvironmentsArea() {
  const t = useT(pipelinesText);
  const go = useGo();
  const environments = useEnvironments();
  const paths = useEnvironmentPaths();
  const clouds = useAllCloudAccounts();
  const groups = groupReadyAccounts(clouds.items);
  const [editing, setEditing] = useState<Environment | 'new' | null>(null);
  const [archiving, setArchiving] = useState<Environment | null>(null);
  const items = environments.data?.items ?? [];
  const create = (
    <Button variant="primary" onClick={() => setEditing('new')}>
      <Icon name="plus" size={14} />
      {t('pipelines.environments.new')}
    </Button>
  );
  const empty = environments.data && items.length === 0;
  return (
    <Area
      title={t('pipelines.platform.environments')}
      meta={t('pipelines.environments.intro')}
      actions={environments.data && !empty ? create : null}
    >
      {empty ? (
        <div className="rounded-card border border-line bg-card">
          <EmptyState
            icon={<Icon name="layers" size={18} />}
            title={t('pipelines.environments.emptyTitle')}
            description={t('pipelines.environments.emptyDescription')}
            headingLevel={2}
            action={
              <span className="flex flex-wrap justify-center gap-2">
                {create}
                {!clouds.pending && groups.length === 0 && (
                  <Button
                    variant="secondary"
                    onClick={() => go({ to: '/platform/clouds/connect' })}
                  >
                    {t('pipelines.clouds.connect')}
                  </Button>
                )}
              </span>
            }
          />
        </div>
      ) : (
        <>
          <Panel title={t('pipelines.environments.paths')}>
            {paths.isError ? (
              <LoadFailed bare size="sm" error={paths.error} onRetry={() => void paths.refetch()} />
            ) : !paths.data || !environments.data ? (
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
              <EnvironmentsTable items={items} onEdit={setEditing} onArchive={setArchiving} />
            )}
          </Panel>
        </>
      )}
      {editing && (
        <EnvironmentDialog
          environment={editing === 'new' ? null : editing}
          groups={groups}
          onClose={() => setEditing(null)}
        />
      )}
      <ArchiveConfirm environment={archiving} onClose={() => setArchiving(null)} />
    </Area>
  );
}
