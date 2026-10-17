import { useT } from '@bemmoly/core-web';
import type { EnvironmentClass, Release } from '@bemmoly/module-pipelines/shared';
import {
  Button,
  EmptyState,
  RelativeTime,
  SearchInput,
  Table,
  Tag,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useDeferredValue } from 'react';
import { useSearchText } from '../../hooks/use-search-state.ts';
import { useReleases } from '../../hooks/use-shipping.ts';
import { useGo } from '../../hooks/use-go.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { promotePath } from '../../parts/promotion-state.ts';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { TierChip } from '../../parts/tier-chip.tsx';

const ORDER: readonly EnvironmentClass[] = ['dev', 'staging', 'prod'];

/** Where a release goes next: one class past the furthest it has reached, Prod at most. */
export function nextClass(release: Pick<Release, 'environments'>): EnvironmentClass {
  const furthest = Math.max(-1, ...release.environments.map((env) => ORDER.indexOf(env.class)));
  return ORDER[Math.min(furthest + 1, ORDER.length - 1)] ?? 'prod';
}

/** Releases in the scope, newest first, searchable by version or commit; Promote from a row. */
export function ReleasesTable({ scope, scopeName }: { scope: string; scopeName: string }) {
  const t = useT(pipelinesText);
  const go = useGo();
  const [q, setQ] = useSearchText('q');
  const search = useDeferredValue(q.trim());
  const releases = useReleases({ scope: scope || undefined, ...(search ? { q: search } : {}) });
  const promote = (release: Release) => go(promotePath(release.id, { to: nextClass(release) }));
  const rows = releases.data?.pages.flatMap((page) => page.items) ?? [];
  const columns: TableColumn<Release>[] = [
    {
      key: 'application',
      header: t('pipelines.releases.colApplication'),
      width: 'minmax(0,1.3fr)',
      render: (release) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-tx">{release.application.name}</span>
          <TierChip tier={release.application.tier} />
        </span>
      ),
    },
    {
      key: 'version',
      header: t('pipelines.releases.colRelease'),
      width: 'minmax(0,0.9fr)',
      render: (release) => (
        <span className="flex min-w-0 flex-col leading-card">
          <span className="truncate font-mono text-12 text-tx">{release.version}</span>
          <span className="truncate font-mono text-11 text-tx-3">
            {release.commitSha.slice(0, 7)}
          </span>
        </span>
      ),
    },
    {
      key: 'source',
      header: t('pipelines.releases.colSource'),
      width: 'minmax(0,0.7fr)',
      hideOnPhone: true,
      render: (release) => (
        <span className="text-12 text-tx-2">
          {t(
            release.source === 'runners'
              ? 'pipelines.releases.sourceRunners'
              : 'pipelines.releases.sourceExternal',
          )}
        </span>
      ),
    },
    {
      key: 'tests',
      header: t('pipelines.releases.colTests'),
      width: 'minmax(0,0.8fr)',
      hideOnPhone: true,
      render: (release) =>
        release.testSummary ? (
          <span
            className={release.testSummary.failed > 0 ? 'text-12 text-red-tx' : 'text-12 text-tx-2'}
          >
            {t('pipelines.releases.tests', {
              passed: release.testSummary.passed,
              total: release.testSummary.total,
            })}
          </span>
        ) : (
          <span className="text-12 text-tx-3">{t('pipelines.releases.noTests')}</span>
        ),
    },
    {
      key: 'runs',
      header: t('pipelines.releases.colRunsIn'),
      width: 'minmax(0,1.2fr)',
      hideOnPhone: true,
      render: (release) =>
        release.environments.length ? (
          <span className="flex min-w-0 flex-wrap gap-1">
            {release.environments.slice(0, 3).map((env) => (
              <Tag key={env.id} size="sm">
                {env.name}
              </Tag>
            ))}
            {release.environments.length > 3 && (
              <Tag size="sm">{`+${release.environments.length - 3}`}</Tag>
            )}
          </span>
        ) : (
          <span className="text-12 text-tx-3">{t('pipelines.releases.nowhere')}</span>
        ),
    },
    {
      key: 'when',
      header: t('pipelines.releases.colWhen'),
      width: 'minmax(0,0.7fr)',
      align: 'end',
      hideOnPhone: true,
      render: (release) => (
        <span className="text-12 text-tx-3">
          <RelativeTime iso={release.createdAt} />
        </span>
      ),
    },
    {
      key: 'promote',
      header: '',
      width: '92px',
      align: 'end',
      render: (release) => (
        <Button
          size="xs"
          variant="secondary"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            promote(release);
          }}
        >
          {t('pipelines.releases.promote')}
        </Button>
      ),
    },
  ];
  return (
    <div className="flex flex-col">
      <div className="px-3 pb-2">
        <SearchInput
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t('pipelines.releases.search')}
          aria-label={t('pipelines.releases.search')}
          className="max-w-90"
        />
      </div>
      {releases.isError && !releases.data ? (
        <LoadFailed
          bare
          size="sm"
          className="m-3"
          error={releases.error}
          onRetry={() => void releases.refetch()}
        />
      ) : !releases.data ? (
        <RowsSkeleton columns={6} rows={8} />
      ) : (
        <Table
          label={t('pipelines.releases.releasesLabel', { scope: scopeName })}
          columns={columns}
          rows={rows}
          rowKey={(release) => release.id}
          onRowClick={promote}
          footer={{
            summary: t('pipelines.releases.shown', { count: rows.length }),
            hasMore: releases.hasNextPage,
            loading: releases.isFetchingNextPage,
            onLoadMore: () => void releases.fetchNextPage(),
            loadMoreLabel: t('pipelines.releases.loadMore'),
          }}
          empty={
            <EmptyState
              size="sm"
              icon={<Icon name="box" size={18} />}
              title={
                search
                  ? t('pipelines.releases.filteredEmpty')
                  : t('pipelines.releases.releasesEmpty', { scope: scopeName })
              }
            />
          }
        />
      )}
    </div>
  );
}
