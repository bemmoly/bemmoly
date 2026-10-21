import type { ControlChart, TimeInStatus } from '@bemmoly/module-work/shared';
import { BarChart, ScatterChart } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { dayLabel } from './model.ts';
import { ReportCard, ReportNote, ReportPending } from './report-card.tsx';

const DAY = 86_400_000;

/** Five evenly spaced dates across the window, the first and last included. */
function dateTicks(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T23:59:59Z`);
  return Array.from({ length: 5 }, (_, index) => {
    const value = start + ((end - start) * index) / 4;
    return { value, label: dayLabel(new Date(value).toISOString().slice(0, 10)) };
  });
}

export function ControlChartCard({
  chart,
  error,
  actions,
}: {
  chart: ControlChart | undefined;
  error: Error | null;
  actions?: ReactNode;
}) {
  const hint = chart?.meanDays != null ? `Mean ${chart.meanDays} days` : 'Cycle time per issue';
  return (
    <ReportCard title="Control chart" hint={hint} actions={actions}>
      {!chart ? (
        <ReportPending error={error} />
      ) : chart.points.length === 0 ? (
        <ReportNote>No issue was finished in this range.</ReportNote>
      ) : (
        <ScatterChart
          label="Control chart"
          pointLabel="Issue"
          yLabel="Cycle days"
          xDomain={[
            Date.parse(`${chart.from}T00:00:00Z`),
            Date.parse(`${chart.to}T00:00:00Z`) + DAY - 1,
          ]}
          xTicks={dateTicks(chart.from, chart.to)}
          formatX={(x) => dayLabel(new Date(x).toISOString().slice(0, 10))}
          points={chart.points.map((point) => ({
            x: Date.parse(point.completedAt),
            y: point.cycleDays,
            label: `${point.key} ${point.title}`,
          }))}
          references={[
            ...(chart.meanDays != null
              ? [
                  {
                    id: 'mean',
                    label: `Mean ${chart.meanDays} days`,
                    value: chart.meanDays,
                    tone: 'ink' as const,
                  },
                ]
              : []),
            ...(chart.medianDays != null
              ? [
                  {
                    id: 'median',
                    label: `Median ${chart.medianDays} days`,
                    value: chart.medianDays,
                    tone: 'muted' as const,
                  },
                ]
              : []),
          ]}
        />
      )}
    </ReportCard>
  );
}

export function TimeInStatusCard({
  report,
  error,
  actions,
}: {
  report: TimeInStatus | undefined;
  error: Error | null;
  actions?: ReactNode;
}) {
  return (
    <ReportCard
      title="Time in status"
      hint="Average days an issue stands in each status"
      actions={actions}
    >
      {!report ? (
        <ReportPending error={error} />
      ) : report.statuses.length === 0 ? (
        <ReportNote>No issue stood in any status in this range.</ReportNote>
      ) : (
        <BarChart
          label="Time in status"
          xLabels={report.statuses.map((status) => status.name)}
          series={[
            {
              id: 'days',
              label: 'Average days',
              tone: 'prog',
              values: report.statuses.map((status) => status.averageDays),
            },
          ]}
        />
      )}
    </ReportCard>
  );
}
