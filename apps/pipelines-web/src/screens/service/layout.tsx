import { useDocumentTitle, useT } from '@bemmoly/core-web';
import {
  Badge,
  Breadcrumbs,
  Button,
  EntityTile,
  entityHue,
  Skeleton,
  type EntityHue,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link, Outlet } from '@tanstack/react-router';
import { pipelinesText, servicesText } from '../../i18n/catalog.ts';
import { RUNTIME_WORD } from '../../parts/bits.tsx';
import { useDeployOrPromote } from '../../parts/deploy-or-promote.tsx';
import { LinkTabs } from '../../parts/link-tabs.tsx';
import { LoadError } from '../../parts/load-error.tsx';
import { useRunPipeline } from '../../parts/run-a-pipeline.tsx';
import { useService, useServiceKey, useServiceVersions } from './use-service.ts';

/**
 * A service's page: where it lives, Run a pipeline and Deploy or promote, then its tabs, each
 * its own address under /services/<key>. The Pipelines tab's content is stream S4's.
 */
export default function ServiceLayout() {
  const t = useT(servicesText);
  const p = useT(pipelinesText);
  const key = useServiceKey();
  const service = useService(key);
  const versions = useServiceVersions(key);
  const deploy = useDeployOrPromote();
  const run = useRunPipeline();
  useDocumentTitle([key, t('pipelinesServices.list.title'), 'Pipelines']);
  const at = `/services/${key}`;
  const row = service.data?.service;
  const count = (value: number | undefined) =>
    value ? (
      <Badge variant="count" className="ms-1">
        {value}
      </Badge>
    ) : null;

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto flex w-full max-w-360 flex-col gap-3 px-4 pt-5 md:px-6">
        <Breadcrumbs
          linkAs={Link}
          items={[
            { label: t('pipelinesServices.list.title'), linkProps: { to: '/services' } },
            { label: row?.domain.name ?? '' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3">
          {row ? (
            <EntityTile
              name={row.key}
              icon="box"
              hue={(row.domain.color as EntityHue | undefined) ?? entityHue(row.key)}
              size={40}
            />
          ) : (
            <Skeleton width={40} height={40} />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="truncate font-mono text-20 leading-title font-semibold text-tx">
              {key}
            </h1>
            {row ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-12 text-tx-3">
                <span className="flex items-center gap-1.5">
                  <Icon name="people" size={14} />
                  {row.team?.name ?? t('pipelinesServices.noTeam')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="branch" size={14} />
                  {[row.repository, row.path].filter(Boolean).join(' · ') ||
                    t('pipelinesServices.service.noRepository')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="cloud" size={14} />
                  {p(RUNTIME_WORD[row.kind])}
                </span>
              </div>
            ) : (
              <Skeleton width={320} height={12} />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Icon name="play" size={14} />} onClick={() => run.open(key)}>
              {t('pipelinesServices.runPipeline')}
            </Button>
            <Button
              variant="primary"
              icon={<Icon name="arrow-up" size={14} />}
              onClick={() => deploy.open({ service: key })}
            >
              {t('pipelinesServices.deployOrPromote')}
            </Button>
          </div>
        </div>
        <LinkTabs
          label={t('pipelinesServices.service.tabs')}
          tabs={[
            { to: at, label: t('pipelinesServices.tab.overview'), exact: true },
            {
              to: `${at}/versions`,
              label: t('pipelinesServices.tab.versions'),
              end: count(versions.data?.items.length),
            },
            { to: `${at}/runs`, label: t('pipelinesServices.tab.runs') },
            { to: `${at}/pipelines`, label: t('pipelinesServices.tab.pipelines') },
            { to: `${at}/settings`, label: t('pipelinesServices.tab.settings') },
            { to: `${at}/logs`, label: t('pipelinesServices.tab.logs') },
          ]}
        />
      </div>
      {service.isError ? (
        <div className="mx-auto w-full max-w-360 px-4 py-5 md:px-6">
          <LoadError
            title={t('pipelinesServices.service.loadFailed')}
            error={service.error}
            onRetry={() => void service.refetch()}
          />
        </div>
      ) : (
        <Outlet />
      )}
      {deploy.dialog}
      {run.dialog}
    </div>
  );
}
