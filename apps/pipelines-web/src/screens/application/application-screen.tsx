import { useT } from '@bemmoly/core-web';
import type { EnvironmentStripItem } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, EmptyState, Kbd, Skeleton, Tabs, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';
import { TierBadge } from '../../parts/bits.tsx';
import { refusalOf } from '../../lib/refusal.ts';
import { LoadError } from '../../parts/load-error.tsx';
import { ScreenFrame } from '../screen-frame.tsx';
import { ApplicationRuns } from './application-runs.tsx';
import { EnvironmentStrip, EnvironmentStripSkeleton } from './environment-strip.tsx';
import { RollbackDialog } from './rollback-dialog.tsx';
import { RunDialog } from './run-dialog.tsx';
import { AboutCard, HealthCard, SIDE_CARD } from './side-cards.tsx';
import { useApplication, useRecentRuns } from './use-application.ts';
import { useApplicationActions } from './use-application-actions.ts';
import { WhatDiffers } from './what-differs.tsx';
import { RecentRuns } from './recent-runs.tsx';
import { VariablesTab } from './variables/variables-tab.tsx';
import { RuntimeCard } from './runtime-card.tsx';
import { FrontDoorCard } from './front-door-card.tsx';
import { ExportButton } from './export-button.tsx';

type Tab = 'overview' | 'runs' | 'variables';

/** The environment the page opens on: the first Prod that lags the one before it. */
function defaultEnvironment(items: readonly EnvironmentStripItem[]): string | null {
  const lagging = items.find(
    (item, index) =>
      index > 0 && item.environment.class === 'prod' && item.version !== items[index - 1]?.version,
  );
  return (
    (lagging ?? items.find((item) => item.environment.class === 'prod') ?? items.at(-1))
      ?.environment.key ?? null
  );
}

/**
 * One application, everything about it: the version in every environment, what differs
 * before a promotion, how Prod is doing, its runs and its variables. P promotes, Shift+B rolls
 * back, R runs.
 */
export default function ApplicationScreen() {
  const t = useT(pipelinesText);
  const navigate = useNavigate();
  const { key = '' } = useParams({ strict: false }) as { key?: string };
  const search = useSearch({ strict: false }) as {
    env?: string;
    tab?: string;
    dialog?: string;
    scope?: string;
  };
  const tab: Tab = search.tab === 'runs' || search.tab === 'variables' ? search.tab : 'overview';
  const { application, strip } = useApplication(key);
  const runs = useRecentRuns(key);
  const items = strip.data?.items ?? [];
  const selectedKey = search.env ?? defaultEnvironment(items);
  const selectedIndex = items.findIndex((item) => item.environment.key === selectedKey);
  const selected = items[selectedIndex];
  const newer =
    selectedIndex > 0
      ? (items
          .slice(0, selectedIndex)
          .reverse()
          .find((item) => item.environment.class !== selected?.environment.class) ??
        items[selectedIndex - 1])
      : undefined;
  const prodItem =
    items.find((item) => item.environment.class === 'prod' && item.state === 'canary') ??
    items.find((item) => item.environment.class === 'prod');
  const name = application.data?.name ?? key;
  const { dialog, setDialog, setSearch, promote, candidate, canRollBack } = useApplicationActions({
    name,
    ready: application.isSuccess,
    items,
    stripReady: strip.isSuccess,
    dialogParam: search.dialog,
  });

  // Opened from a link without a scope, the crumbs still read Acme › Commerce › Checkout.
  const home = application.data
    ? `${application.data.domain.key}/${application.data.group.key}`
    : null;
  const scoped = Boolean(search.scope);
  useEffect(() => {
    if (home && !scoped) setSearch({ scope: home });
  }, [home, scoped, setSearch]);

  if (application.isError && refusalOf(application.error)) {
    return (
      <ScreenFrame title={key}>
        <LoadError
          title={t('pipelines.application.loadFailed')}
          error={application.error}
          onRetry={() => void application.refetch()}
        />
      </ScreenFrame>
    );
  }
  if (application.isError) {
    const missing = (application.error as { code?: string }).code === 'not_found';
    return (
      <ScreenFrame title={key}>
        <div className="rounded-card border border-line bg-card py-12 shadow-e1">
          <EmptyState
            icon={<Icon name={missing ? 'box' : 'warning'} size={18} />}
            title={
              missing
                ? t('pipelines.application.notFound', { key })
                : t('pipelines.application.loadFailed')
            }
            description={
              missing ? t('pipelines.application.notFoundHint') : t('pipelines.common.loadFailed')
            }
            headingLevel={2}
            action={
              missing ? (
                <Button onClick={() => void navigate({ to: '/catalog' })}>
                  {t('pipelines.application.backToCatalog')}
                </Button>
              ) : (
                <Button onClick={() => void application.refetch()}>
                  {t('pipelines.common.tryAgain')}
                </Button>
              )
            }
          />
        </div>
      </ScreenFrame>
    );
  }

  const app = application.data;
  const keyHint = (keys: string) => (
    <Kbd keys={keys} variant="plain" className="ms-1 max-md:hidden" />
  );
  return (
    <ScreenFrame
      title={name}
      heading={
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="truncate text-24 leading-title font-semibold text-tx">{name}</h1>
          {app ? <TierBadge tier={app.tier} /> : <Skeleton width={28} height={16} />}
          {app?.labels.slice(0, 3).map((label) => (
            <Badge key={label}>{label}</Badge>
          ))}
        </div>
      }
      actions={
        <>
          <ExportButton application={key} ready={Boolean(app)} />
          <Button variant="ghost" onClick={() => setDialog('run')} disabled={!app}>
            <Icon name="play" size={14} />
            {t('pipelines.application.run')}
            {keyHint('R')}
          </Button>
          <Tooltip
            label={
              canRollBack
                ? t('pipelines.application.rollbackTip')
                : t('pipelines.application.rollbackNone')
            }
            keys="Shift+B"
          >
            <Button
              onClick={() => setDialog('rollback')}
              disabled={!canRollBack}
              className="text-red-tx"
            >
              <Icon name="undo" size={14} />
              {t('pipelines.application.rollback')}
            </Button>
          </Tooltip>
          <Tooltip
            label={
              candidate?.releaseId
                ? t('pipelines.application.promoteTip', { version: candidate.version ?? '' })
                : t('pipelines.application.promoteNone')
            }
            keys="P"
          >
            <Button variant="primary" onClick={promote} disabled={!candidate?.releaseId}>
              <Icon name="rocket" size={14} />
              {t('pipelines.application.promote')}
            </Button>
          </Tooltip>
        </>
      }
    >
      <Tabs
        aria-label={t('pipelines.application.sections')}
        items={[
          { value: 'overview', label: t('pipelines.application.tabOverview') },
          { value: 'runs', label: t('pipelines.application.tabRuns') },
          { value: 'variables', label: t('pipelines.application.tabVariables') },
        ]}
        value={tab}
        onChange={(value) => setSearch({ tab: value === 'overview' ? undefined : value })}
        className="-mt-2"
      />
      {tab === 'runs' ? (
        <ApplicationRuns application={key} />
      ) : tab === 'variables' ? (
        <VariablesTab
          application={key}
          environment={search.env ?? null}
          onEnvironment={(env) => setSearch({ env: env ?? undefined })}
        />
      ) : (
        <>
          {strip.isPending ? (
            <EnvironmentStripSkeleton />
          ) : strip.isError ? (
            <div className="flex items-center gap-3 rounded-card border border-line bg-card px-4 py-3 text-13 text-tx-2 shadow-e1">
              {t('pipelines.strip.failed')}
              <Button size="sm" variant="ghost" onClick={() => void strip.refetch()}>
                {t('pipelines.common.tryAgain')}
              </Button>
            </div>
          ) : (
            <EnvironmentStrip
              items={items}
              selected={selectedKey}
              onSelect={(env) => setSearch({ env })}
            />
          )}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className={SIDE_CARD}>
              {strip.isError ? null : strip.data ? (
                <WhatDiffers application={key} target={selected} newer={newer} />
              ) : (
                <Skeleton width="50%" height={16} />
              )}
              <h2 className="mt-3 text-16 leading-title font-semibold text-tx">
                {t('pipelines.application.recentRuns')}
              </h2>
              <RecentRuns runs={runs} onAll={() => setSearch({ tab: 'runs' })} />
            </section>
            <div className="flex flex-col gap-4">
              {app ? (
                <HealthCard app={app} prod={prodItem} />
              ) : (
                <div className={SIDE_CARD}>
                  <Skeleton width="60%" height={14} />
                </div>
              )}
              {app ? (
                <AboutCard app={app} />
              ) : (
                <div className={SIDE_CARD}>
                  <Skeleton width="40%" height={14} />
                </div>
              )}
              <RuntimeCard application={key} />
              <FrontDoorCard application={key} />
            </div>
          </div>
        </>
      )}
      <RunDialog application={key} open={dialog === 'run'} onClose={() => setDialog(null)} />
      <RollbackDialog
        application={key}
        items={items}
        initial={selectedKey}
        open={dialog === 'rollback'}
        onClose={() => setDialog(null)}
      />
    </ScreenFrame>
  );
}
