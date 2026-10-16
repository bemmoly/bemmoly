import { formatNumber, useT } from '@bemmoly/core-web';
import { Button, EmptyState, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Overview } from '@bemmoly/module-pipelines/shared';
import { useOverview } from '../hooks/use-overview.ts';
import { pipelinesText } from '../i18n/catalog.ts';
import { formatDuration, formatShare } from '../lib/format.ts';
import { ScreenFrame } from './screen-frame.tsx';

function greetingId(hour: number) {
  if (hour < 12) return 'pipelines.forYou.greetingMorning' as const;
  if (hour < 18) return 'pipelines.forYou.greetingAfternoon' as const;
  return 'pipelines.forYou.greetingEvening' as const;
}

/** "Acme today: 1,284 runs · 212 deploys to Prod · 2.1% change failure · 3h 10m lead time". */
function Pulse({ overview }: { overview: Overview }) {
  const t = useT(pipelinesText);
  const { today } = overview;
  const stat = (value: string, label: string) => (
    <span className="flex items-baseline gap-1.5">
      <b className="font-semibold text-tx tabular-nums">{value}</b>
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-12 text-tx-2">
      <span>{t('pipelines.forYou.scopeToday', { scope: overview.scope.organisation })}</span>
      {stat(formatNumber(today.runs), t('pipelines.forYou.runs', { count: today.runs }))}
      {stat(
        formatNumber(today.prodDeploys),
        t('pipelines.forYou.prodDeploys', { count: today.prodDeploys }),
      )}
      {today.changeFailureRate !== null &&
        stat(formatShare(today.changeFailureRate), t('pipelines.forYou.changeFailure'))}
      {today.leadTimeSeconds !== null &&
        stat(formatDuration(today.leadTimeSeconds), t('pipelines.forYou.leadTime'))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-card p-4 shadow-e1">
      <h2 className="text-16 leading-title font-semibold text-tx">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Where an engineer lands: their changes as journeys, the approvals waiting on them, their
 * teams' broken builds. The header's numbers are live; the panels fill as runs and promotions
 * land.
 */
export default function ForYouScreen() {
  const t = useT(pipelinesText);
  const overview = useOverview('');
  const name = overview.data?.me.firstName ?? '';
  return (
    <ScreenFrame title={t('pipelines.forYou.title')}>
      <div className="-mt-2 flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <p className="text-16 text-tx">
          {overview.data ? (
            t(greetingId(new Date().getHours()), { name })
          ) : (
            <Skeleton width={180} height={16} />
          )}
        </p>
        {overview.isError ? (
          <span className="flex items-center gap-2 text-12 text-red-tx">
            {t('pipelines.common.loadFailed')}
            <Button size="sm" variant="ghost" onClick={() => void overview.refetch()}>
              {t('pipelines.common.tryAgain')}
            </Button>
          </span>
        ) : overview.data ? (
          <Pulse overview={overview.data} />
        ) : (
          <Skeleton width={360} height={12} />
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={t('pipelines.forYou.changesTitle')}>
          <EmptyState
            size="sm"
            icon={<Icon name="branch" size={16} />}
            title={t('pipelines.forYou.changesEmpty')}
          />
        </Panel>
        <Panel title={t('pipelines.forYou.waitingTitle')}>
          <EmptyState
            size="sm"
            icon={<Icon name="shield" size={16} />}
            title={t('pipelines.forYou.waitingEmpty')}
          />
        </Panel>
      </div>
    </ScreenFrame>
  );
}
