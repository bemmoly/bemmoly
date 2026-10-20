import type { SprintReport } from '@bemmoly/module-work/shared';
import { BarChart, LineChart } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { dayLabel, guideline } from './model.ts';
import { ReportCard, ReportNote } from './report-card.tsx';
import { SprintIssues } from './sprint-issues.tsx';

interface CardProps {
  report: SprintReport;
  actions?: ReactNode;
}

const NO_DAYS = 'This sprint has no days to draw yet.';

/** The sprint's remaining points per day against a straight guideline to zero. */
export function BurndownCard({ report, actions }: CardProps) {
  const { sprint, burndown } = report;
  return (
    <ReportCard title="Burndown" hint={`${sprint.name}, points remaining`} actions={actions}>
      {burndown.length === 0 ? (
        <ReportNote>{NO_DAYS}</ReportNote>
      ) : (
        <LineChart
          label={`${sprint.name} burndown`}
          xLabels={burndown.map((point) => dayLabel(point.date))}
          series={[
            {
              id: 'guide',
              label: 'Guideline',
              tone: 'muted',
              dashed: true,
              values: guideline(burndown),
            },
            {
              id: 'remaining',
              label: 'Remaining',
              tone: 'prog',
              values: burndown.map((point) => point.remainingPoints),
            },
          ]}
        />
      )}
    </ReportCard>
  );
}

/** The sprint's scope and completed points per day, so added scope shows as a rising line. */
export function BurnupCard({ report, actions }: CardProps) {
  const { sprint, burnup } = report;
  return (
    <ReportCard
      title="Burnup"
      hint={`${sprint.name}, scope and completed points`}
      actions={actions}
    >
      {burnup.length === 0 ? (
        <ReportNote>{NO_DAYS}</ReportNote>
      ) : (
        <LineChart
          label={`${sprint.name} burnup`}
          xLabels={burnup.map((point) => dayLabel(point.date))}
          series={[
            {
              id: 'scope',
              label: 'Scope',
              tone: 'ink',
              values: burnup.map((point) => point.scopePoints),
            },
            {
              id: 'completed',
              label: 'Completed',
              tone: 'done',
              values: burnup.map((point) => point.completedPoints),
            },
          ]}
        />
      )}
    </ReportCard>
  );
}

/** Committed and completed points of the last closed sprints. */
export function VelocityCard({ report, actions }: CardProps) {
  const { velocity } = report;
  return (
    <ReportCard
      title="Velocity"
      hint="Committed and completed points, last closed sprints"
      actions={actions}
    >
      {velocity.length === 0 ? (
        <ReportNote>No sprint has closed yet. Velocity starts with the first one.</ReportNote>
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

/** The chosen sprint's burndown and burnup, its report, and the velocity up to now. */
export function SprintReports({
  report,
  onOpenIssue,
}: {
  report: SprintReport;
  onOpenIssue: (key: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <BurndownCard report={report} />
        <BurnupCard report={report} />
      </div>
      <ReportCard title="Sprint report" hint={report.sprint.goal ?? report.sprint.name}>
        <SprintIssues scope={report.scope} onOpen={onOpenIssue} />
      </ReportCard>
      <VelocityCard report={report} />
    </>
  );
}
