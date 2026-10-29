import { useT } from '@bemmoly/core-web';
import type { CloudAccount, CloudConnection } from '@bemmoly/module-pipelines/shared';
import { Button, ConfirmChange, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useAccountWrites, useCloudAccounts } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { AttachDialog } from './attach-dialog.tsx';
import { ProjectSummary } from './project-summary.tsx';

/**
 * The projects attached to a connection. A project that failed its check stays listed with
 * what it found, so the grants can be fixed and the check run again; detaching asks first
 * and is refused, with the reason, while an environment still deploys there.
 */
export function AttachedProjects({ connection }: { connection: CloudConnection }) {
  const t = useT(pipelinesText);
  const accounts = useCloudAccounts(connection.id);
  const { recheck, detach } = useAccountWrites(connection.id);
  const [attaching, setAttaching] = useState(false);
  const [leaving, setLeaving] = useState<CloudAccount | null>(null);
  const items = accounts.data?.items ?? [];
  const attach = (
    <Button size="sm" variant="secondary" onClick={() => setAttaching(true)}>
      <Icon name="plus" size={14} />
      {t('pipelines.clouds.attach')}
    </Button>
  );
  const closeDetach = () => {
    detach.reset();
    setLeaving(null);
  };
  return (
    <Panel
      flush
      title={t('pipelines.clouds.projects')}
      meta={accounts.data && String(items.length)}
      actions={items.length > 0 ? attach : null}
    >
      {accounts.isError ? (
        <LoadFailed bare size="sm" error={accounts.error} onRetry={() => void accounts.refetch()} />
      ) : !accounts.data ? (
        <RowsSkeleton columns={3} rows={2} />
      ) : items.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Icon name="box" size={18} />}
          title={t('pipelines.clouds.noProjectsTitle')}
          description={t('pipelines.clouds.noProjectsDescription')}
          action={attach}
        />
      ) : (
        <ul aria-label={t('pipelines.clouds.projectsLabel', { name: connection.name })}>
          {items.map((account) => (
            <li key={account.id} className="border-t border-line-2 px-4 py-3">
              <ProjectSummary
                account={account}
                actions={
                  <>
                    <Button
                      size="xs"
                      variant="ghost"
                      loading={recheck.isPending && recheck.variables === account.id}
                      onClick={() => recheck.mutate(account.id)}
                    >
                      {t('pipelines.clouds.checkAgain')}
                    </Button>
                    {account.origin === 'attached' && (
                      <Button size="xs" variant="ghost" onClick={() => setLeaving(account)}>
                        {t('pipelines.clouds.detach')}
                      </Button>
                    )}
                  </>
                }
              />
              {recheck.isError && recheck.variables === account.id && (
                <div className="mt-2">
                  <ActionError error={recheck.error} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <AttachDialog connection={connection} open={attaching} onClose={() => setAttaching(false)} />
      <ConfirmChange
        open={leaving !== null}
        title={t('pipelines.clouds.detachTitle', { project: leaving?.externalId ?? '' })}
        consequences={[
          t('pipelines.clouds.detachStops', { project: leaving?.externalId ?? '' }),
          t('pipelines.clouds.detachKeeps'),
        ]}
        confirmLabel={t('pipelines.clouds.detachConfirm')}
        busy={detach.isPending}
        error={<ActionError error={detach.error} />}
        onCancel={closeDetach}
        onConfirm={() => leaving && detach.mutate(leaving.id, { onSuccess: closeDetach })}
      />
    </Panel>
  );
}
