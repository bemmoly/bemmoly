import { formatDate, formatNumber, useT } from '@bemmoly/core-web';
import type { Capacity, RunnerPool } from '@bemmoly/module-pipelines/shared';
import { Button, SegmentedControl, SeriesChart, Skeleton, StatTile } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId, useState } from 'react';
import { useCapacity } from '../../../hooks/use-capacity.ts';
import { useSearchState } from '../../../hooks/use-search-state.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { formatDuration, formatShare } from '../../../lib/format.ts';
import { Area } from '../../../parts/area.tsx';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { Builds } from './builds.tsx';
import { PoolDialog } from './pool-dialog.tsx';
import { Pools } from './pools.tsx';
import { Queue } from './queue.tsx';
import { RotateToken } from './rotate-token.tsx';
import { Teams } from './teams.tsx';

const RANGES = ['now', '7d', '30d'] as const;
const QUEUE_SHOWN = 12;

function Stats({ capacity }: { capacity: Capacity }) {
  const t = useT(pipelinesText);
  const { stats } = capacity;
  const slow = stats.waitP95Seconds !== null && stats.waitP95Seconds > stats.waitTargetSeconds;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile
        label={t('pipelines.capacity.running')}
        value={formatNumber(stats.running)}
        detail={t('pipelines.capacity.ofSlots', { slots: stats.slots })}
      />
      <StatTile
        label={t('pipelines.capacity.queued')}
        value={formatNumber(stats.queued)}
        detail={
          stats.oldestWaitSeconds === null
            ? t('pipelines.capacity.nothingWaits')
            : t('pipelines.capacity.oldest', { wait: formatDuration(stats.oldestWaitSeconds) })
        }
      />
      <StatTile
        label={t('pipelines.capacity.waitP95')}
        value={
          stats.waitP95Seconds === null
            ? t('pipelines.insights.none')
            : formatDuration(stats.waitP95Seconds)
        }
        detail={t('pipelines.capacity.target', { wait: formatDuration(stats.waitTargetSeconds) })}
        detailTone={slow ? 'worse' : 'default'}
      />
      <StatTile
        label={t('pipelines.capacity.buildMinutes')}
        value={formatNumber(stats.buildMinutesToday)}
        detail={t('pipelines.capacity.billed')}
      />
      <StatTile
        label={t('pipelines.capacity.cacheSaved')}
        value={
          stats.cacheSavedRatio === null
            ? t('pipelines.insights.none')
            : formatShare(stats.cacheSavedRatio)
        }
        detail={
          stats.cacheSavedMinutes === null
            ? t('pipelines.capacity.noCache')
            : t('pipelines.capacity.cacheMinutes', { minutes: stats.cacheSavedMinutes })
        }
        className="col-span-2 lg:col-span-1"
      />
    </div>
  );
}

function Concurrency({ capacity }: { capacity: Capacity }) {
  const t = useT(pipelinesText);
  const points = capacity.concurrency.map((point) => ({
    at: Date.parse(point.start),
    value: point.jobs,
  }));
  const time = (iso: string) =>
    formatDate(iso, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <Panel
      title={t('pipelines.capacity.concurrency')}
      meta={
        capacity.peak &&
        t('pipelines.capacity.peak', { jobs: capacity.peak.jobs, at: time(capacity.peak.at) })
      }
    >
      {points.length > 1 ? (
        <>
          <SeriesChart
            kind="bars"
            points={points}
            threshold={capacity.stats.slots}
            height={110}
            ariaLabel={t('pipelines.capacity.concurrencyLabel', {
              peak: capacity.peak?.jobs ?? 0,
              slots: capacity.stats.slots,
            })}
          />
          <p className="mt-1.5 flex justify-between text-11 text-tx-3">
            <span>{capacity.concurrency[0] && time(capacity.concurrency[0].start)}</span>
            <span>{t('pipelines.capacity.slotsLine', { slots: capacity.stats.slots })}</span>
            <span>{t('pipelines.capacity.now')}</span>
          </p>
        </>
      ) : (
        <p className="py-2 text-13 text-tx-3">{t('pipelines.capacity.noHistory')}</p>
      )}
    </Panel>
  );
}

/**
 * Platform › Capacity: runner pools and how busy they are, each team's fair share, the queue
 * and why it waits, and the build minutes the cloud will bill. Live from the dispatcher. A
 * pool takes machines people start, or has Cloud Build or GKE Autopilot start one per job;
 * those show while they run.
 */
export default function CapacityArea() {
  const t = useT(pipelinesText);
  const [range, setRange] = useSearchState('range', RANGES, 'now');
  const capacity = useCapacity({ range });
  const [editing, setEditing] = useState<RunnerPool | 'new' | null>(null);
  const buildsTitle = useId();
  const [rotating, setRotating] = useState<RunnerPool | null>(null);
  const data = capacity.data;
  return (
    <Area
      title={t('pipelines.platform.capacity')}
      meta={
        <SegmentedControl
          size="sm"
          options={[
            { value: 'now', label: t('pipelines.capacity.rangeNow') },
            { value: '7d', label: t('pipelines.insights.rangeDays', { days: 7 }) },
            { value: '30d', label: t('pipelines.insights.rangeDays', { days: 30 }) },
          ]}
          value={range}
          onChange={setRange}
        />
      }
      actions={
        <Button variant="secondary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={14} />
          {t('pipelines.capacity.addPool')}
        </Button>
      }
    >
      {capacity.isError && !data ? (
        <LoadFailed error={capacity.error} onRetry={() => void capacity.refetch()} />
      ) : !data ? (
        <div aria-busy className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {RANGES.concat(RANGES)
            .slice(0, 5)
            .map((key, index) => (
              <Skeleton key={`${key}${index}`} height={92} shape="block" />
            ))}
        </div>
      ) : (
        <>
          <Stats capacity={data} />
          <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[1.25fr_1fr]">
            <div className="flex min-w-0 flex-col gap-3">
              <Panel flush title={t('pipelines.capacity.pools')}>
                <Pools pools={data.pools} onRotate={setRotating} onEdit={setEditing} />
              </Panel>
              {data.pools.some(
                (pool) => pool.hosting === 'cloud-build' || pool.hosting === 'gke-autopilot',
              ) && (
                <Panel
                  flush
                  labelledBy={buildsTitle}
                  title={t('pipelines.capacity.builds')}
                  meta={t('pipelines.capacity.buildsCount', {
                    count: data.pools.reduce((sum, pool) => sum + pool.machines.length, 0),
                  })}
                >
                  <Builds pools={data.pools} />
                </Panel>
              )}
              <Concurrency capacity={data} />
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <Panel flush title={t('pipelines.capacity.teams')}>
                <Teams teams={data.teams} />
              </Panel>
              <Panel
                flush
                title={t('pipelines.capacity.queue')}
                meta={t('pipelines.capacity.waiting', { count: data.stats.queued })}
              >
                <Queue items={data.queue.slice(0, QUEUE_SHOWN)} />
              </Panel>
            </div>
          </div>
        </>
      )}
      {!data && !capacity.isError && <RowsSkeleton columns={3} rows={4} />}
      {editing && (
        <PoolDialog pool={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
      <RotateToken pool={rotating} onClose={() => setRotating(null)} />
    </Area>
  );
}
