import { STAT_FIELDS, type ReportStats, type StatField } from '@bemmoly/module-work/shared';
import { BarChart, Select } from '@bemmoly/ui';
import { setSearchParams } from '../shared/url-state.ts';
import { ReportCard, ReportNote, ReportPending, ReportSection } from './report-card.tsx';
import { StatsTable } from './stats-table.tsx';
import { STAT_FIELD_LABELS, useReportStats } from './use-report-stats.ts';

const FIELD_OPTIONS = STAT_FIELDS.map((field) => ({
  value: field,
  label: STAT_FIELD_LABELS[field],
}));
const NONE = 'none';

const share = (count: number, total: number) =>
  total > 0 ? `${Math.round((count / total) * 100)}%` : '0%';

/** One field: a bar per value, then the same numbers as a list with each value's share. */
function SingleField({ stats, field }: { stats: ReportStats; field: StatField }) {
  const name = STAT_FIELD_LABELS[field];
  return (
    <div className="flex flex-col gap-4">
      <BarChart
        label={`Issues by ${name.toLowerCase()}`}
        xLabels={stats.rows.map((row) => row.label)}
        series={[
          { id: 'issues', label: 'Issues', tone: 'prog', values: stats.rows.map((r) => r.count) },
        ]}
      />
      <ul
        aria-label={`Issues by ${name.toLowerCase()}`}
        className="m-0 flex list-none flex-col p-0"
      >
        {stats.rows.map((row) => (
          <li
            key={row.id ?? 'none'}
            className="flex items-baseline gap-3 border-b border-line py-1 text-13 last:border-b-0"
          >
            <span className="mr-auto min-w-0 truncate text-tx">{row.label}</span>
            <span className="font-mono text-12 tabular-nums text-tx">{row.count}</span>
            <span className="w-10 text-right font-mono text-12 tabular-nums text-tx-3">
              {share(row.count, stats.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The project's issues counted by one field, or by two crossed in a table. */
export function StatsSection({ projectKey }: { projectKey: string }) {
  const { by, by2, stats } = useReportStats(projectKey);
  const data = stats.data;
  const title = by2
    ? `${STAT_FIELD_LABELS[by]} by ${STAT_FIELD_LABELS[by2].toLowerCase()}`
    : `Issues by ${STAT_FIELD_LABELS[by].toLowerCase()}`;
  return (
    <ReportSection
      title="Statistics"
      controls={
        <>
          <Select
            aria-label="Group by"
            className="w-40 max-md:w-full"
            value={by}
            options={FIELD_OPTIONS}
            onChange={(event) =>
              setSearchParams({ stat: event.value === 'status' ? null : event.value })
            }
          />
          <Select
            aria-label="Then by"
            className="w-40 max-md:w-full"
            value={by2 ?? NONE}
            options={[
              { value: NONE, label: 'None' },
              ...FIELD_OPTIONS.filter((option) => option.value !== by),
            ]}
            onChange={(event) =>
              setSearchParams({ stat2: event.value === NONE ? null : event.value })
            }
          />
        </>
      }
    >
      <ReportCard title={title} hint={data ? `${data.total} issues` : undefined}>
        {!data ? (
          <ReportPending error={stats.error} />
        ) : data.total === 0 ? (
          <ReportNote>This project has no issues yet.</ReportNote>
        ) : data.by2 ? (
          <StatsTable stats={data} caption={title} />
        ) : (
          <SingleField stats={data} field={data.by} />
        )}
      </ReportCard>
    </ReportSection>
  );
}
