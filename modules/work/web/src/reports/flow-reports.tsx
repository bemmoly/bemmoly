import type { FlowReport } from '@bemmoly/module-work/shared';
import { LineChart } from '@bemmoly/ui';
import { dayLabel, runningTotals } from './model.ts';
import { ReportCard, ReportNote } from './report-card.tsx';

/** The project-wide reports: cumulative flow and created against resolved over the range. */
export function FlowReports({ report }: { report: FlowReport }) {
  const days = report.days;
  const labels = days.map((day) => dayLabel(day.date));
  const empty = days.every((day) => day.todo + day.inProgress + day.done === 0);
  const totals = runningTotals(days);
  return (
    <>
      <ReportCard
        title="Cumulative flow"
        hint="Issues in each status category at the end of each day"
      >
        {empty ? (
          <ReportNote>No issues existed in this range.</ReportNote>
        ) : (
          <LineChart
            label="Cumulative flow"
            stacked
            xLabels={labels}
            series={[
              { id: 'done', label: 'Done', tone: 'done', values: days.map((day) => day.done) },
              {
                id: 'progress',
                label: 'In progress',
                tone: 'prog',
                values: days.map((day) => day.inProgress),
              },
              { id: 'todo', label: 'To do', tone: 'todo', values: days.map((day) => day.todo) },
            ]}
          />
        )}
      </ReportCard>
      <ReportCard
        title="Created vs resolved"
        hint={`${totals.at(-1)?.created ?? 0} created, ${totals.at(-1)?.resolved ?? 0} resolved`}
      >
        <LineChart
          label="Created vs resolved"
          xLabels={labels}
          series={[
            {
              id: 'created',
              label: 'Created',
              tone: 'prog',
              values: totals.map((day) => day.created),
            },
            {
              id: 'resolved',
              label: 'Resolved',
              tone: 'done',
              values: totals.map((day) => day.resolved),
            },
          ]}
        />
      </ReportCard>
    </>
  );
}
