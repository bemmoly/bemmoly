import { useT } from '@bemmoly/core-web';
import type {
  InsightsBreakdown,
  InsightsRange,
  InsightsRow,
} from '@bemmoly/module-pipelines/shared';
import { SegmentedControl } from '@bemmoly/ui';
import { useInsights } from '../../hooks/use-insights.ts';
import { useScope } from '../../hooks/use-scope.ts';
import { useSearchState } from '../../hooks/use-search-state.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { Panel, Screen } from '../../parts/screen.tsx';
import { useScopeName } from '../screen-frame.tsx';
import { Breakdown } from './breakdown.tsx';
import { Measures, MeasuresSkeleton } from './measures.tsx';

const RANGES: readonly InsightsRange[] = ['30d', '90d', '180d'];
const DAYS: Record<InsightsRange, number> = { '30d': 30, '90d': 90, '180d': 180 };
const BY: readonly InsightsBreakdown[] = ['scope', 'team'];

/**
 * Insights: are we getting faster and safer? The four delivery measures for the scope over a
 * range, against the range before, then a row per domain, group or team. Choosing a domain or
 * group row zooms the scope, like the map.
 */
export default function InsightsScreen() {
  const t = useT(pipelinesText);
  const { path, domain, group, setScope } = useScope();
  const scopeName = useScopeName();
  const [range, setRange] = useSearchState('range', RANGES, '90d');
  const [by, setBy] = useSearchState('by', BY, 'scope');
  const insights = useInsights({ scope: path || undefined, range, by });
  const level: InsightsRow['kind'] = by === 'team' || group ? 'team' : domain ? 'group' : 'domain';
  const open = (row: InsightsRow) =>
    setScope(row.kind === 'group' && domain ? `${domain}/${row.key}` : row.key);
  return (
    <Screen
      title={t('pipelines.insights.title')}
      meta={scopeName && t('pipelines.insights.meta', { scope: scopeName, days: DAYS[range] })}
      actions={
        <SegmentedControl
          size="sm"
          options={RANGES.map((value) => ({
            value,
            label: t('pipelines.insights.rangeDays', { days: DAYS[value] }),
          }))}
          value={range}
          onChange={setRange}
        />
      }
    >
      {insights.isError && !insights.data ? (
        <LoadFailed error={insights.error} onRetry={() => void insights.refetch()} />
      ) : insights.data ? (
        <Measures insights={insights.data} days={DAYS[range]} />
      ) : (
        <MeasuresSkeleton />
      )}
      <Panel
        flush
        title={t('pipelines.insights.breakdownTitle')}
        actions={
          group ? null : (
            <SegmentedControl
              size="sm"
              options={[
                {
                  value: 'scope',
                  label: t(domain ? 'pipelines.insights.byGroup' : 'pipelines.insights.byDomain'),
                },
                { value: 'team', label: t('pipelines.insights.byTeam') },
              ]}
              value={by}
              onChange={setBy}
            />
          )
        }
      >
        {insights.data ? (
          <Breakdown rows={insights.data.rows} level={level} onOpen={open} />
        ) : insights.isError ? null : (
          <RowsSkeleton columns={6} rows={6} />
        )}
      </Panel>
    </Screen>
  );
}
