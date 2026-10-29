import { useT } from '@bemmoly/core-web';
import type { CloudConnection } from '@bemmoly/module-pipelines/shared';
import { Select } from '@bemmoly/ui';
import { useAccountWrites, useCloudAccounts } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';

const NONE = 'none';

/**
 * Which attached project holds CI secrets and secrets set for every environment, chosen where
 * it is shown. A secret for one environment always lives in that environment's own project.
 */
export function CiProjectRow({ connection }: { connection: CloudConnection }) {
  const t = useT(pipelinesText);
  const accounts = useCloudAccounts(connection.id);
  const { ciAccount } = useAccountWrites(connection.id);
  const ready = (accounts.data?.items ?? []).filter((account) => account.status === 'ready');
  if (ready.length === 0 && !connection.ciAccountId) return null;
  const labelId = `ci-project-${connection.id}`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-12">
        <span id={labelId} className="text-tx-3">
          {t('pipelines.clouds.ciProject')}
        </span>
        <Select
          variant="ghost"
          aria-labelledby={labelId}
          value={connection.ciAccountId ?? NONE}
          disabled={ciAccount.isPending}
          options={[
            { value: NONE, label: t('pipelines.clouds.ciProjectNone') },
            ...ready.map((account) => ({ value: account.id, label: account.externalId })),
          ]}
          onChange={(event) => ciAccount.mutate(event.value === NONE ? null : event.value)}
        />
        <span className="text-tx-3">{t('pipelines.clouds.ciProjectHint')}</span>
      </div>
      <ActionError error={ciAccount.error} />
    </div>
  );
}
