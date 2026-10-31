import { useT } from '@bemmoly/core-web';
import type { EnvironmentStripItem, ReleaseCompare } from '@bemmoly/module-pipelines/shared';
import { Avatar, Badge, Button, KeyChip, Skeleton } from '@bemmoly/ui';
import { ApiError } from '@bemmoly/api-client';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../i18n/catalog.ts';
import { useCompare } from './use-application.ts';

function Commits({ compare }: { compare: ReleaseCompare }) {
  return (
    <ul className="flex flex-col">
      {compare.commits.slice(0, 12).map((commit) => {
        const author = commit.author?.name ?? commit.authorLogin;
        return (
          <li
            key={commit.sha}
            className="flex items-center gap-3 border-b border-line-2 py-2 text-13"
          >
            <span className="shrink-0 font-mono text-12 text-tx-3">{commit.sha.slice(0, 7)}</span>
            <span className="min-w-0 flex-1 truncate text-tx">{commit.message}</span>
            {commit.issueKey ? <KeyChip issueKey={commit.issueKey} /> : null}
            {author ? <Avatar name={author} size={18} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Prod in us-east1 is 4 commits behind Staging": what exactly changes if the newer release
 * moves on, before anyone promotes it. Commits, issues, migrations and configuration.
 */
export function WhatDiffers({
  application,
  target,
  newer,
}: {
  application: string;
  target: EnvironmentStripItem | undefined;
  newer: EnvironmentStripItem | undefined;
}) {
  const t = useT(pipelinesText);
  const compare = useCompare(
    application,
    target?.environment.key ?? null,
    newer?.environment.key ?? null,
  );
  if (!target || !newer) {
    return (
      <p className="text-13 text-tx-2">
        {t('pipelines.differs.firstStop', { env: target?.environment.name ?? '' })}
      </p>
    );
  }
  const names = { env: target.environment.name, other: newer.environment.name };
  if (compare.isPending)
    return (
      <div aria-busy className="flex flex-col gap-2">
        <Skeleton width="60%" height={16} />
        <Skeleton width="40%" height={10} />
      </div>
    );
  // Nothing deployed on one side yet (a new application): the server says so in words.
  if (compare.isError && compare.error instanceof ApiError && compare.error.code === 'not_found')
    return <p className="text-13 text-tx-2">{compare.error.message}</p>;
  if (compare.isError)
    return (
      <div className="flex items-center gap-3 text-13 text-tx-2">
        {t('pipelines.differs.failed', names)}
        <Button size="sm" variant="ghost" onClick={() => void compare.refetch()}>
          {t('pipelines.common.tryAgain')}
        </Button>
      </div>
    );
  const data = compare.data;
  const behind = data.counts.commits;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-16 leading-title font-semibold text-tx">
          {behind === 0
            ? t('pipelines.differs.same', names)
            : t('pipelines.differs.behind', { ...names, count: behind })}
        </h2>
        {data.compareUrl ? (
          <Button
            size="sm"
            variant="ghost"
            className="ms-auto"
            onClick={() => window.open(data.compareUrl ?? '', '_blank', 'noopener')}
          >
            {t('pipelines.differs.openForge')}
            <Icon name="external" size={12} />
          </Button>
        ) : null}
      </div>
      {behind > 0 ? (
        <>
          <p className="text-12 text-tx-2">
            {t('pipelines.differs.summary', {
              from: data.from?.version ?? '',
              to: data.to.version,
              issues: data.counts.issues,
              migrations: data.counts.migrations,
              config: data.counts.config,
            })}
          </p>
          <Commits compare={data} />
          {data.migrations.length || data.config.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.migrations.map((migration) => (
                <Badge key={migration.description} tone="warn" className="gap-1">
                  <Icon name="database" size={12} />
                  {t(
                    migration.reversible
                      ? 'pipelines.differs.migrationReversible'
                      : 'pipelines.differs.migration',
                    {
                      description: migration.description,
                    },
                  )}
                </Badge>
              ))}
              {data.config.map((change) => (
                <Badge key={change.name}>
                  {change.secret || change.from === null || change.to === null
                    ? t('pipelines.differs.configSecret', { name: change.name })
                    : t('pipelines.differs.config', {
                        name: change.name,
                        from: change.from,
                        to: change.to,
                      })}
                </Badge>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
