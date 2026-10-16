import { formatDateTime, formatNumber, useScreenActions, useT } from '@bemmoly/core-web';
import type { MapColumn, MapRow } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, RunGlyph, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { ScreenFrame } from '../screen-frame.tsx';
import { MapGrid, MapGridSkeleton } from './map-grid.tsx';
import { MapTimeline } from './map-timeline.tsx';
import { useMapState, useReleaseMap } from './use-map.ts';

const STEP_MS = 15 * 60_000;

/**
 * The organisation's delivery on one screen, live: rows are domains (groups inside a domain,
 * applications inside a group), columns the path to Prod, dots the releases moving. The
 * timeline rewinds it; the address keeps the scope and the moment.
 */
export default function MapScreen() {
  const t = useT(pipelinesText);
  const navigate = useNavigate();
  const { state, set } = useMapState();
  const map = useReleaseMap(state);
  const teams = useQuery({
    queryKey: pipelinesKeys.teams(false),
    queryFn: () => api.pipelines.teams(false),
    staleTime: 5 * 60_000,
  });
  const data = map.data;
  const zoomOut = () => {
    if (!state.scope) return;
    const parent = state.scope.split('/').slice(0, -1).join('/');
    set({ scope: parent || undefined, open: undefined });
  };
  const step = (by: number) => {
    const timeline = data?.timeline ?? [];
    const first = timeline[0]?.start;
    if (!first) return;
    const now = Date.now();
    const current = state.at ? Date.parse(state.at) : now;
    const next = Math.max(Date.parse(first), current + by * STEP_MS);
    set({ at: next >= now - STEP_MS / 2 ? undefined : new Date(next).toISOString() }, true);
  };
  const actions = {
    onZoom: (row: MapRow) => {
      if (row.zoomTo !== null) set({ scope: row.zoomTo || undefined, open: undefined });
      else void navigate({ to: '/applications/$key', params: { key: row.key } });
    },
    onToggle: (row: MapRow) => {
      const open = state.open.includes(row.key)
        ? state.open.filter((key) => key !== row.key)
        : [...state.open, row.key];
      set({ open: open.length ? open.join(',') : undefined }, true);
    },
    onOpenCell: (row: MapRow, column: MapColumn) =>
      void navigate({
        to: '/applications/$key',
        params: { key: row.key },
        // ?env= is the application page's own; the route types only the shared scope.
        search: (previous: { scope?: string }) =>
          (column.kind === 'environment' ? { ...previous, env: column.key } : previous) as {
            scope?: string;
          },
      }),
  };
  useScreenKeys({
    '[': () => step(-1),
    ']': () => step(1),
    l: () => set({ at: undefined }),
    backspace: zoomOut,
  });
  useScreenActions([
    {
      id: 'map.live',
      title: t('pipelines.map.backToLive'),
      keys: 'L',
      run: () => set({ at: undefined }),
    },
    { id: 'map.back', title: t('pipelines.map.stepBack'), keys: '[', run: () => step(-1) },
    ...(state.scope
      ? [{ id: 'map.out', title: t('pipelines.map.zoomOut'), keys: 'Backspace', run: zoomOut }]
      : []),
  ]);

  const legend = (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-12 text-tx-3">
      {(['running', 'waiting', 'failed'] as const).map((state) => (
        <span key={state} className="flex items-center gap-1">
          <RunGlyph state={state} size={12} />
          {t(`pipelines.map.legend.${state}`)}
        </span>
      ))}
      {data ? (
        <span className="tabular-nums">
          {t('pipelines.map.totals', {
            applications: formatNumber(data.totals.applications),
            domains: data.totals.domains,
          })}
        </span>
      ) : null}
    </span>
  );
  return (
    <ScreenFrame
      title={t('pipelines.map.title')}
      meta={state.at ? t('pipelines.map.rewoundTo', { time: formatDateTime(state.at) }) : null}
      actions={
        <>
          <Select
            size="sm"
            value={state.team ?? ''}
            placeholder={t('pipelines.map.team')}
            aria-label={t('pipelines.map.team')}
            options={[
              { value: '', label: t('pipelines.map.allTeams') },
              ...(teams.data?.items ?? []).map((team) => ({ value: team.id, label: team.name })),
            ]}
            onChange={(event) => set({ team: event.value || undefined })}
          />
          <Select
            size="sm"
            value={state.tier === null ? '' : String(state.tier)}
            placeholder={t('pipelines.map.tier')}
            aria-label={t('pipelines.map.tier')}
            options={[
              { value: '', label: t('pipelines.map.allTiers') },
              ...[0, 1, 2].map((tier) => ({
                value: String(tier),
                label: t(`pipelines.tier.${tier as 0 | 1 | 2}`),
              })),
            ]}
            onChange={(event) => set({ tier: event.value || undefined })}
          />
        </>
      }
    >
      <div className="-mt-2 flex flex-wrap items-center gap-3">
        {legend}
        {state.scope ? (
          <Button size="xs" variant="ghost" className="ms-auto" onClick={zoomOut}>
            <Icon name="back" size={12} />
            {t('pipelines.map.zoomOut')}
          </Button>
        ) : null}
      </div>
      {map.isError ? (
        <div className="rounded-card border border-line bg-card py-12 shadow-e1">
          <EmptyState
            icon={<Icon name="warning" size={18} />}
            title={t('pipelines.map.errorTitle')}
            description={t('pipelines.common.loadFailed')}
            headingLevel={2}
            action={
              <Button onClick={() => void map.refetch()}>{t('pipelines.common.tryAgain')}</Button>
            }
          />
        </div>
      ) : !data ? (
        <MapGridSkeleton />
      ) : data.rows.length === 0 ? (
        <div className="rounded-card border border-line bg-card py-12 shadow-e1">
          <EmptyState
            icon={<Icon name="map" size={18} />}
            title={t('pipelines.map.emptyTitle')}
            description={t('pipelines.map.emptyDescription')}
            headingLevel={2}
          />
        </div>
      ) : (
        <MapGrid
          rows={data.rows}
          columns={data.columns}
          state={state}
          actions={actions}
          label={t('pipelines.map.gridLabel', { scope: data.scope.name })}
        />
      )}
      {data ? (
        <MapTimeline
          buckets={data.timeline}
          at={state.at}
          onCommit={(at) => set({ at: at ?? undefined }, true)}
        />
      ) : null}
    </ScreenFrame>
  );
}
