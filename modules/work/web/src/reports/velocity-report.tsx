import type { VelocityPoint } from '@bemmoly/module-work/shared';
import { BarChart, Table, type TableColumn } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { issuesAndPoints, share } from './model.ts';
import { ReportCard, ReportNote } from './report-card.tsx';

const EMPTY = 'No sprint has closed yet. Velocity starts with the first one.';

/** Committed against completed points, last closed sprints. */
export function VelocityChart({
  velocity,
  actions,
}: {
  velocity: readonly VelocityPoint[];
  actions?: ReactNode;
}) {
  return (
    <ReportCard
      title="Velocity"
      hint="Committed and completed points, last closed sprints"
      actions={actions}
    >
      {velocity.length === 0 ? (
        <ReportNote>{EMPTY}</ReportNote>
      ) : (
        <BarChart
          label="Velocity"
          xLabels={velocity.map((point) => point.name)}
          series={[
            {
              id: 'committed',
              label: 'Committed',
              tone: 'todo',
              values: velocity.map((point) => point.committedPoints),
            },
            {
              id: 'completed',
              label: 'Completed',
              tone: 'done',
              values: velocity.map((point) => point.completedPoints),
            },
          ]}
        />
      )}
    </ReportCard>
  );
}

const figure = 'font-mono text-12 tabular-nums';

const COLUMNS: readonly TableColumn<VelocityPoint>[] = [
  { key: 'name', header: 'Sprint', width: 'minmax(0,1.2fr)', render: (point) => point.name },
  {
    key: 'committed',
    header: 'Committed',
    width: 'minmax(0,1fr)',
    align: 'end',
    hideOnPhone: true,
    render: (point) => <span className={figure}>{point.committedPoints} pts</span>,
  },
  {
    key: 'completed',
    header: 'Completed',
    width: 'minmax(0,1fr)',
    align: 'end',
    hideOnPhone: true,
    render: (point) => <span className={figure}>{point.completedPoints} pts</span>,
  },
  {
    key: 'carried',
    header: 'Carried over',
    width: 'minmax(0,1.4fr)',
    align: 'end',
    render: (point) => (
      <span className={figure}>
        {issuesAndPoints(point.carriedOverIssues, point.carriedOverPoints)}
      </span>
    ),
  },
  {
    key: 'added',
    header: 'Added after start',
    width: 'minmax(0,1.4fr)',
    align: 'end',
    render: (point) => (
      <span className={figure}>
        {share(point.addedIssues, point.scopeIssues)} of issues,{' '}
        {share(point.addedPoints, point.scopePoints)} of pts
      </span>
    ),
  },
];

/** Per closed sprint: the work it inherited unfinished and the scope that joined it late. */
export function SprintChangesTable({ velocity }: { velocity: readonly VelocityPoint[] }) {
  return (
    <ReportCard
      title="Spillover and added scope"
      hint="Carried over from the sprint before, and work that joined after the start"
    >
      {velocity.length === 0 ? (
        <ReportNote>{EMPTY}</ReportNote>
      ) : (
        <Table
          label="Spillover and added scope per sprint"
          density="sm"
          columns={COLUMNS}
          rows={[...velocity].reverse()}
          rowKey={(point) => point.sprintId}
        />
      )}
    </ReportCard>
  );
}
