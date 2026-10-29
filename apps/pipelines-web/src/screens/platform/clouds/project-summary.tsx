import { useT } from '@bemmoly/core-web';
import type { CloudAccount } from '@bemmoly/module-pipelines/shared';
import { Badge, RelativeTime, type BadgeTone } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { pipelinesText } from '../../../i18n/catalog.ts';

const TONE: Record<CloudAccount['status'], BadgeTone> = {
  planned: 'neutral',
  creating: 'neutral',
  ready: 'ok',
  drifted: 'warn',
  failed: 'danger',
};

/**
 * One attached project as its check left it: the project ID, its name when it differs, the
 * state, who deploys and runs there, and each problem as a sentence saying what to grant.
 */
export function ProjectSummary({
  account,
  actions,
}: {
  account: CloudAccount;
  actions?: ReactNode;
}) {
  const t = useT(pipelinesText);
  const identities = [
    t('pipelines.clouds.deploysAs', {
      account: account.deployerServiceAccount ?? t('pipelines.clouds.deploysAsSelf'),
    }),
    t('pipelines.clouds.runsAs', {
      account: account.runtimeServiceAccount ?? t('pipelines.clouds.runsAsDefault'),
    }),
  ];
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="truncate font-mono text-13 font-medium text-tx">{account.externalId}</span>
        {account.name !== account.externalId && (
          <span className="truncate text-12 text-tx-2">{account.name}</span>
        )}
        <Badge tone={TONE[account.status]}>
          {t(`pipelines.clouds.accountStatus.${account.status}`)}
        </Badge>
        {account.lastCheckedAt && (
          <span className="text-12 text-tx-3">
            {t('pipelines.clouds.checked')} <RelativeTime iso={account.lastCheckedAt} />
          </span>
        )}
        {actions && <span className="ms-auto flex gap-1">{actions}</span>}
      </div>
      <p className="truncate text-12 text-tx-3">{identities.join(' · ')}</p>
      {account.problems.length > 0 && (
        <ul
          aria-label={t('pipelines.clouds.problemsLabel', { project: account.externalId })}
          className="flex list-disc flex-col gap-1 ps-5 text-12 leading-body text-tx-2"
        >
          {account.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
