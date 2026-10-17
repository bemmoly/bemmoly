import { formatNumber, useT } from '@bemmoly/core-web';
import type { Overview } from '@bemmoly/module-pipelines/shared';
import { Button, Skeleton } from '@bemmoly/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import { pipelinesText } from '../../i18n/catalog.ts';
import { formatShare, formatSpan } from '../../lib/format.ts';

export function greetingId(hour: number) {
  if (hour < 12) return 'pipelines.forYou.greetingMorning' as const;
  if (hour < 18) return 'pipelines.forYou.greetingAfternoon' as const;
  return 'pipelines.forYou.greetingEvening' as const;
}

/** "Acme today: 1,284 runs · 212 deploys to Prod · 2.1% change failure · 3h 10m lead time". */
export function Pulse({ overview }: { overview: UseQueryResult<Overview> }) {
  const t = useT(pipelinesText);
  if (overview.isError)
    return (
      <span className="flex items-center gap-2 text-12 text-red-tx">
        {t('pipelines.common.loadFailed')}
        <Button size="sm" variant="ghost" onClick={() => void overview.refetch()}>
          {t('pipelines.common.tryAgain')}
        </Button>
      </span>
    );
  if (!overview.data) return <Skeleton width={360} height={12} />;
  const { today, scope } = overview.data;
  const stat = (value: string, label: string) => (
    <span className="flex items-baseline gap-1.5">
      <b className="font-semibold text-tx tabular-nums">{value}</b>
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-12 text-tx-2">
      <span>{t('pipelines.forYou.scopeToday', { scope: scope.organisation })}</span>
      {stat(formatNumber(today.runs), t('pipelines.forYou.runs', { count: today.runs }))}
      {stat(
        formatNumber(today.prodDeploys),
        t('pipelines.forYou.prodDeploys', { count: today.prodDeploys }),
      )}
      {today.changeFailureRate !== null &&
        stat(formatShare(today.changeFailureRate), t('pipelines.forYou.changeFailure'))}
      {today.leadTimeSeconds !== null &&
        stat(formatSpan(today.leadTimeSeconds), t('pipelines.forYou.leadTime'))}
    </div>
  );
}
