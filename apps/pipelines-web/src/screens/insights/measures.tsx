import { useT } from '@bemmoly/core-web';
import type { Insights } from '@bemmoly/module-pipelines/shared';
import { SeriesChart, Skeleton, StatTile } from '@bemmoly/ui';
import { pipelinesText } from '../../i18n/catalog.ts';
import { formatMeasure, MEASURES, trendOf, type MeasureKey, type Trend } from './format.ts';

const LABEL = {
  leadTime: 'pipelines.insights.leadTime',
  deployFrequency: 'pipelines.insights.deployFrequency',
  changeFailureRate: 'pipelines.insights.changeFailureRate',
  timeToRestore: 'pipelines.insights.timeToRestore',
} as const satisfies Record<MeasureKey, string>;

function useTrendWords() {
  const t = useT(pipelinesText);
  return (key: MeasureKey, trend: Trend, days: number) => {
    if (trend.kind === 'none') return t('pipelines.insights.trendNone');
    if (trend.kind === 'same') return t('pipelines.insights.trendSame', { days });
    const points = key === 'changeFailureRate';
    if (trend.kind === 'up') {
      return points
        ? t('pipelines.insights.trendUpPoints', { change: trend.change, days })
        : t('pipelines.insights.trendUp', { change: trend.change, days });
    }
    return points
      ? t('pipelines.insights.trendDownPoints', { change: trend.change, days })
      : t('pipelines.insights.trendDown', { change: trend.change, days });
  };
}

/** The four delivery measures for the scope, each against the range before it, by week. */
export function Measures({ insights, days }: { insights: Insights; days: number }) {
  const t = useT(pipelinesText);
  const words = useTrendWords();
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {MEASURES.map((key) => {
        const measure = insights.measures[key];
        const trend = trendOf(key, measure.value, measure.previous);
        const weeks = measure.weeks.flatMap((week) =>
          week.value === null ? [] : [{ at: Date.parse(week.start), value: week.value }],
        );
        return (
          <StatTile
            key={key}
            label={t(LABEL[key])}
            value={
              measure.value === null
                ? t('pipelines.insights.none')
                : formatMeasure(key, measure.value)
            }
            detail={
              measure.value === null ? t('pipelines.insights.noneDetail') : words(key, trend, days)
            }
            detailTone={
              trend.kind === 'up' || trend.kind === 'down'
                ? trend.better
                  ? 'better'
                  : 'worse'
                : 'default'
            }
          >
            {weeks.length > 1 && (
              <SeriesChart
                points={weeks}
                baseline="fit"
                height={40}
                ariaLabel={t('pipelines.insights.byWeek', { measure: t(LABEL[key]) })}
              />
            )}
          </StatTile>
        );
      })}
    </div>
  );
}

export function MeasuresSkeleton() {
  return (
    <div aria-busy className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {MEASURES.map((key) => (
        <div
          key={key}
          className="flex flex-col gap-2 rounded-card border border-line bg-card p-3.5"
        >
          <Skeleton width={120} height={12} />
          <Skeleton width={90} height={24} />
          <Skeleton width={160} height={12} />
          <Skeleton height={40} />
        </div>
      ))}
    </div>
  );
}
