import { formatNumber, useT } from '@bemmoly/core-web';
import type { ForYouSummary } from '@bemmoly/module-pipelines/shared';
import { Button, Skeleton, StatTile } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { useMe } from '../../hooks/use-me.ts';
import { forYouText } from '../../i18n/catalog.ts';
import { formatSpan } from '../../lib/format.ts';
import { useDeployOrPromote } from '../../parts/deploy-or-promote.tsx';
import { LoadError } from '../../parts/load-error.tsx';
import { RunLine, RunLinesSkeleton } from '../../parts/run-line.tsx';
import { useRunPipeline } from '../../parts/run-a-pipeline.tsx';
import { ScreenFrame } from '../screen-frame.tsx';
import { ApproverForYouSlot } from './approver-for-you-slot.tsx';
import { CARD, CardHead, NeedsYou, YourServices } from './for-you-cards.tsx';
import { greetingId, todayLine, weekChange } from './greeting.ts';
import { SetupChecklistSlot } from './setup-checklist-slot.tsx';
import { useForYouKind, useForYouSummary } from './use-for-you.ts';

function Stats({ summary }: { summary: ForYouSummary }) {
  const t = useT(forYouText);
  const { stats, lastEnvironment } = summary;
  const change = weekChange(stats.deploysThisWeek, stats.deploysLastWeek);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label={t('pipelinesForYou.stats.deploys')}
        value={formatNumber(stats.deploysThisWeek)}
        detail={change === null ? undefined : t('pipelinesForYou.stats.deploysChange', { change })}
        detailTone={change === null || change === 0 ? 'default' : change > 0 ? 'better' : 'worse'}
      />
      <StatTile
        label={t('pipelinesForYou.stats.changes', { environment: lastEnvironment?.name ?? '' })}
        value={formatNumber(stats.changesToLast.total)}
        detail={t('pipelinesForYou.stats.changesDetail', {
          approved: stats.changesToLast.approved,
          rejected: stats.changesToLast.rejected,
        })}
      />
      <StatTile
        label={t('pipelinesForYou.stats.approval')}
        value={
          stats.approvalMedianSeconds === null
            ? t('pipelinesForYou.stats.noneYet')
            : formatSpan(stats.approvalMedianSeconds)
        }
        detail={t('pipelinesForYou.stats.approvalDetail')}
      />
      <StatTile
        label={t('pipelinesForYou.stats.failing')}
        value={formatNumber(stats.failingNow)}
        detail={
          stats.firstFailing
            ? t('pipelinesForYou.stats.failingDetail', stats.firstFailing)
            : t('pipelinesForYou.stats.failingNone')
        }
        detailTone={stats.failingNow > 0 ? 'worse' : 'default'}
      />
    </div>
  );
}

/** For you for a developer or a Platform admin: stats, what needs them, what runs, theirs. */
function DeveloperForYou() {
  const t = useT(forYouText);
  const { summary, running } = useForYouSummary();
  const runs = running.data?.items ?? [];
  if (summary.isError)
    return (
      <LoadError
        title={t('pipelinesForYou.loadFailed')}
        error={summary.error}
        onRetry={() => void summary.refetch()}
      />
    );
  return (
    <>
      {summary.data ? <Stats summary={summary.data} /> : <Skeleton width="100%" height={88} />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {summary.data ? <NeedsYou needs={summary.data.needsYou} /> : <RunLinesSkeleton />}
          <section className={CARD} aria-labelledby="running-now">
            <CardHead
              id="running-now"
              title={t('pipelinesForYou.running.title')}
              end={
                <Link to="/runs" className="text-12 text-acc focus-ring">
                  {t('pipelinesForYou.running.all')}
                </Link>
              }
            />
            {running.data ? (
              runs.length ? (
                <ul className="flex flex-col">
                  {runs.map((run) => (
                    <RunLine key={run.id} run={run} />
                  ))}
                </ul>
              ) : (
                <span className="py-2 text-13 text-tx-3">{t('pipelinesForYou.running.none')}</span>
              )
            ) : (
              <RunLinesSkeleton />
            )}
          </section>
        </div>
        {summary.data ? <YourServices summary={summary.data} /> : <RunLinesSkeleton rows={5} />}
      </div>
    </>
  );
}

/**
 * Where everyone lands. A fresh install shows the setup checklist until it is done; an
 * approver sees the changes sent to them; developers and admins see their day.
 */
export default function ForYouScreen() {
  const t = useT(forYouText);
  const me = useMe();
  const kind = useForYouKind();
  const deploy = useDeployOrPromote();
  const run = useRunPipeline();
  const now = new Date();
  const name = me.data?.user.name.split(' ')[0] ?? '';
  return (
    <ScreenFrame
      title={t('pipelinesForYou.title')}
      heading={
        <div className="flex flex-col gap-0.5">
          <span className="text-12 text-tx-3">{todayLine(now)}</span>
          <h1 className="text-20 leading-title font-semibold text-tx">
            {me.data ? (
              t(greetingId(now.getHours()), { name })
            ) : (
              <Skeleton width={220} height={20} />
            )}
          </h1>
        </div>
      }
      actions={
        kind === 'developer' ? (
          <>
            <Button icon={<Icon name="play" size={14} />} onClick={() => run.open()}>
              {t('pipelinesForYou.runPipeline')}
            </Button>
            <Button
              variant="primary"
              icon={<Icon name="arrow-up" size={14} />}
              onClick={() => deploy.open({})}
            >
              {t('pipelinesForYou.promote')}
            </Button>
          </>
        ) : null
      }
    >
      {kind === 'loading' ? (
        <Skeleton width="100%" height={88} />
      ) : kind === 'setup' ? (
        <SetupChecklistSlot />
      ) : kind === 'approver' ? (
        <ApproverForYouSlot />
      ) : (
        <DeveloperForYou />
      )}
      {deploy.dialog}
      {run.dialog}
    </ScreenFrame>
  );
}
