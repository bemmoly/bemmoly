import type { SprintReport } from '@bemmoly/module-work/shared';
import { BarChart, LineChart } from '@bemmoly/ui';
import { dayLabel, guideline } from './model.ts';
import { ReportCard, ReportNote } from './report-card.tsx';
import { SprintIssues } from './sprint-issues.tsx';

/** The chosen sprint's burndown and burnup, its report, and the velocity up to now. */
export function SprintReports({
  report,
  onOpenIssue,
}: {
  report: SprintReport;
  onOpenIssue: (key: string) => void;
}) {
  const { sprint, burndown, burnup, velocity, scope } = report;
  const labels = burndown.map((point) => dayLabel(point.date));
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportCard title="Burndown" hint={`${sprint.name}, points remaining`}>
          {burndown.length === 0 ? (
            <ReportNote>This sprint has no days to draw yet.</ReportNote>
          ) : (
            <LineChart
              label={`${sprint.name} burndown`}
              xLabels={labels}
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
        <ReportCard title="Burnup" hint={`${sprint.name}, scope and completed points`}>
          {burnup.length === 0 ? (
            <ReportNote>This sprint has no days to draw yet.</ReportNote>
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
      </div>
      <ReportCard title="Sprint report" hint={sprint.goal ?? sprint.name}>
        <SprintIssues scope={scope} onOpen={onOpenIssue} />
      </ReportCard>
      <ReportCard title="Velocity" hint="Committed and completed points, last closed sprints">
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
    </>
  );
}
