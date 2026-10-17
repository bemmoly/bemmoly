import { useT } from '@bemmoly/core-web';
import type { CloudAccount } from '@bemmoly/module-pipelines/shared';
import { ProvisionChecklist, type ProvisionState } from '@bemmoly/ui';
import { useCloudAccounts } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
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

/** The landing zone being made, account by account, refreshed until nothing is in flight. */
export function ApplyProgress({ connection }: { connection: string }) {
  const t = useT(pipelinesText);
  const accounts = useCloudAccounts(connection, true);
  const items = accounts.data?.items ?? [];
  const ready = items.filter((account) => account.status === 'ready').length;
  return (
    <Panel
      title={t('pipelines.clouds.creating')}
      meta={t('pipelines.clouds.readyOf', { ready, total: items.length })}
    >
      <ProvisionChecklist
        ariaLabel={t('pipelines.clouds.creating')}
        stateLabel={(state) => t(WORDS[state])}
        steps={items.map((account) => ({
          key: account.id,
          title: account.name,
          description: account.domain
            ? `${account.domain.name} · ${account.environmentClass ? t(`pipelines.envClass.${account.environmentClass}`) : ''}`
            : t(`pipelines.clouds.purpose.${account.purpose}`),
          state: STATE[account.status],
        }))}
      />
    </Panel>
  );
}
