import { useT } from '@bemmoly/core-web';
import type { ServiceEnvironment, ServiceVersion } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, EmptyState, RelativeTime, Table, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { servicesText } from '../../i18n/catalog.ts';
import { StateGlyph } from '../../parts/bits.tsx';
import { useDeployOrPromote, type DeployTarget } from '../../parts/deploy-or-promote.tsx';
import { LoadError } from '../../parts/load-error.tsx';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { ChangeChip } from '../services/running-cell.tsx';
import { CARD } from './card.ts';
import { useServiceKey, useServiceVersions } from './use-service.ts';

/** Where a version goes next: the environment after the furthest one it runs in. */
export function nextEnvironment(
  version: ServiceVersion,
  environments: readonly ServiceEnvironment[],
): ServiceEnvironment | null {
  const furthest = Math.max(
    -1,
    ...version.runningIn.map((key) => environments.findIndex((each) => each.key === key)),
  );
  return environments[furthest + 1] ?? null;
}

function useColumns(
  environments: readonly ServiceEnvironment[],
  onDeploy: (target: DeployTarget) => void,
  service: string,
): TableColumn<ServiceVersion>[] {
  const t = useT(servicesText);
  return [
    {
      key: 'version',
      header: t('pipelinesServices.versions.version'),
      width: 'minmax(90px,0.8fr)',
      render: (row) => (
        <span className="font-mono text-14 font-semibold text-tx">{row.version}</span>
      ),
    },
    {
      key: 'what',
      header: t('pipelinesServices.versions.whatChanged'),
      width: 'minmax(180px,2fr)',
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-13 text-tx">
            {row.message ?? row.commitSha.slice(0, 7)}
          </span>
          <span className="font-mono text-11 text-tx-3">{row.commitSha.slice(0, 7)}</span>
        </span>
      ),
    },
    {
      key: 'built',
      header: t('pipelinesServices.versions.built'),
      width: 'minmax(110px,1fr)',
      hideOnPhone: true,
      render: (row) => (
        <span className="flex min-w-0 flex-col text-12">
          <RelativeTime iso={row.createdAt} className="text-tx-2" />
          {row.createdBy ? (
            <span className="truncate text-tx-3">
              {t('pipelinesServices.overview.by', { name: row.createdBy })}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'tests',
      header: t('pipelinesServices.versions.tests'),
      width: '70px',
      align: 'center',
      hideOnPhone: true,
      render: (row) =>
        row.tests ? (
          <StateGlyph state={row.tests.failed > 0 ? 'failed' : 'passed'} />
        ) : (
          <span className="text-12 text-tx-3">{t('pipelinesServices.none')}</span>
        ),
    },
    {
      key: 'running',
      header: t('pipelinesServices.versions.runningIn'),
      width: 'minmax(160px,1.4fr)',
      render: (row) => (
        <span className="flex flex-wrap gap-1">
          {environments.map((environment) => (
            <Badge
              key={environment.key}
              tone={row.runningIn.includes(environment.key) ? 'accent' : 'outline'}
            >
              {environment.name}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'change',
      header: t('pipelinesServices.versions.change'),
      width: 'minmax(110px,1fr)',
      hideOnPhone: true,
      render: (row) =>
        row.change ? (
          <ChangeChip change={row.change} />
        ) : (
          <span className="text-12 text-tx-3">{t('pipelinesServices.none')}</span>
        ),
    },
    {
      key: 'action',
      header: <span className="sr-only">{t('pipelinesServices.versions.action')}</span>,
      width: '110px',
      align: 'end',
      render: (row) => {
        const next = nextEnvironment(row, environments);
        const last = environments.at(-1);
        const target = next ?? last;
        if (!target) return null;
        return (
          <Button
            size="sm"
            onClick={(event) => {
              event.stopPropagation();
              onDeploy({ service, version: row.version, environment: target.key });
            }}
          >
            {next
              ? t('pipelinesServices.versions.promote')
              : t('pipelinesServices.versions.redeploy')}
          </Button>
        );
      },
    },
  ];
}

/**
 * Versions: every build that passed its tests, newest first, where each runs and the change
 * request that carried it. Versions move between environments unchanged.
 */
export default function ServiceVersions() {
  const t = useT(servicesText);
  const key = useServiceKey();
  const versions = useServiceVersions(key);
  const deploy = useDeployOrPromote();
  const columns = useColumns(versions.data?.environments ?? [], deploy.open, key);
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      <p className="flex items-start gap-2 rounded-control bg-sunken px-3 py-2.5 text-13 text-tx-2">
        <Icon name="info" size={14} className="mt-0.5 shrink-0" />
        {t('pipelinesServices.versions.about')}
      </p>
      {versions.isError ? (
        <LoadError
          title={t('pipelinesServices.versions.loadFailed')}
          error={versions.error}
          onRetry={() => void versions.refetch()}
        />
      ) : !versions.data ? (
        <RowsSkeleton columns={6} />
      ) : versions.data.items.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            icon={<Icon name="tag" size={18} />}
            title={t('pipelinesServices.versions.empty')}
            description={t('pipelinesServices.versions.emptyHint')}
          />
        </div>
      ) : (
        <Table
          label={t('pipelinesServices.tab.versions')}
          columns={columns}
          rows={versions.data.items}
          rowKey={(row) => row.releaseId}
        />
      )}
      {deploy.dialog}
    </div>
  );
}
