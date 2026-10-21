import type { FlowReport } from '@bemmoly/module-work/shared';
import { LineChart } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { dayLabel, runningTotals } from './model.ts';
import { ReportCard, ReportNote } from './report-card.tsx';

interface CardProps {
  report: FlowReport;
  actions?: ReactNode;
}

/** Issues in each status category at the end of each day of the range, stacked. */
export function CumulativeFlowCard({ report, actions }: CardProps) {
  const days = report.days;
  const empty = days.every((day) => day.todo + day.inProgress + day.done === 0);
  return (
    <ReportCard
      title="Cumulative flow"
      hint="Issues in each status category at the end of each day"
      actions={actions}
    >
      {empty ? (
        <ReportNote>No issues existed in this range.</ReportNote>
      ) : (
        <LineChart
          label="Cumulative flow"
          stacked
          xLabels={days.map((day) => dayLabel(day.date))}
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
  );
}

/** Running totals of issues created and resolved over the range. */
export function CreatedResolvedCard({ report, actions }: CardProps) {
  const totals = runningTotals(report.days);
  return (
    <ReportCard
      title="Created vs resolved"
      hint={`${totals.at(-1)?.created ?? 0} created, ${totals.at(-1)?.resolved ?? 0} resolved`}
      actions={actions}
    >
      <LineChart
        label="Created vs resolved"
        xLabels={report.days.map((day) => dayLabel(day.date))}
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
  );
}

/** The project-wide reports: cumulative flow and created against resolved over the range. */
export function FlowReports({ report }: { report: FlowReport }) {
  return (
    <>
      <CumulativeFlowCard report={report} />
      <CreatedResolvedCard report={report} />
    </>
  );
}
