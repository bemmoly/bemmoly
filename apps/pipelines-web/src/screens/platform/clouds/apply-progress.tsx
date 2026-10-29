import { useT } from '@bemmoly/core-web';
import type { CloudAccount } from '@bemmoly/module-pipelines/shared';
import { Button, ProvisionChecklist, type ProvisionState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useCloudAccounts, useCloudWrites, usePlanProgress } from '../../../hooks/use-clouds.ts';
import { useGo } from '../../../hooks/use-go.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { Panel } from '../../../parts/screen.tsx';

const STATE: Record<CloudAccount['status'], ProvisionState> = {
  planned: 'todo',
  creating: 'working',
  ready: 'done',
  drifted: 'failed',
  failed: 'failed',
};

const WORDS = {
  todo: 'pipelines.provision.todo',
  current: 'pipelines.provision.current',
  working: 'pipelines.provision.working',
  done: 'pipelines.provision.done',
  failed: 'pipelines.provision.failed',
} as const satisfies Record<ProvisionState, string>;

/**
 * The landing zone being made, project by project, refreshed until the plan is applied or
 * has stopped. A stop says why in one sentence, with Retry: it applies the same plan again,
 * which starts where it stopped and makes nothing twice.
 */
export function ApplyProgress({ connection, plan }: { connection: string; plan: string }) {
  const t = useT(pipelinesText);
  const go = useGo();
  const progress = usePlanProgress(connection, plan);
  const status = progress.data?.status ?? 'applying';
  const accounts = useCloudAccounts(connection, status === 'applying');
  const { apply } = useCloudWrites();
  const items = accounts.data?.items ?? [];
  const ready = items.filter((account) => account.status === 'ready').length;
  const retry = () => {
    if (!progress.data) return;
    apply.mutate(
      { id: connection, body: { planId: plan, specHash: progress.data.specHash } },
      { onSuccess: () => void progress.refetch() },
    );
  };
  return (
    <Panel
      title={
        status === 'applied' ? t('pipelines.clouds.createdTitle') : t('pipelines.clouds.creating')
      }
      meta={t('pipelines.clouds.readyOf', { ready, total: items.length })}
    >
      {status === 'failed' && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center gap-3 rounded-control bg-amber-50 px-3 py-2 text-12 text-amber-tx"
        >
          <Icon name="warning" size={14} className="shrink-0" />
          <span className="min-w-0 flex-1">
            {progress.data?.lastError ?? t('pipelines.clouds.applyStopped')}
          </span>
          <Button size="xs" variant="secondary" loading={apply.isPending} onClick={retry}>
            {t('pipelines.clouds.retry')}
          </Button>
        </div>
      )}
      <ActionError error={apply.error} />
      <ProvisionChecklist
        ariaLabel={t('pipelines.clouds.creating')}
        stateLabel={(state) => t(WORDS[state])}
        steps={items.map((account) => ({
          key: account.id,
          title: account.name,
          description: account.domain
            ? `${account.domain.name} · ${account.environmentClass ? t(`pipelines.envClass.${account.environmentClass}`) : ''}`
            : `${account.externalId} · ${t(`pipelines.clouds.purpose.${account.purpose}`)}`,
          state: STATE[account.status],
        }))}
      />
      {status === 'applied' && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-12 text-tx-2">{t('pipelines.clouds.createdNext')}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => go({ to: '/platform/environments' })}
          >
            {t('pipelines.clouds.toEnvironments')}
          </Button>
        </div>
      )}
    </Panel>
  );
}
