import type { SprintChanges, SprintReport } from '@bemmoly/module-work/shared';
import { LineChart, MetricTile } from '@bemmoly/ui';
import { dayLabel, guideline, issuesAndPoints, share } from './model.ts';
import { ReportCard, ReportNote } from './report-card.tsx';
import { SprintIssues } from './sprint-issues.tsx';
import { SprintChangesTable, VelocityChart } from './velocity-report.tsx';

/**
 * The chosen sprint's burndown, burnup and the velocity up to now side by side, then its
 * report with spillover and late scope, and those two per closed sprint.
 */
export function SprintReports({
  report,
  onOpenIssue,
}: {
  report: SprintReport;
  onOpenIssue: (key: string) => void;
}) {
  const { sprint, burndown, burnup, velocity, scope, changes } = report;
  const labels = burndown.map((point) => dayLabel(point.date));
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
        <VelocityChart velocity={velocity} />
      </div>
      <ReportCard title="Sprint report" hint={sprint.goal ?? sprint.name}>
        <SprintChangeTiles changes={changes} />
        <SprintIssues scope={scope} onOpen={onOpenIssue} />
      </ReportCard>
      <SprintChangesTable velocity={velocity} />
    </>
  );
}

/** The sprint's spillover and late scope as two figures above its lists. */
function SprintChangeTiles({ changes }: { changes: SprintChanges }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <MetricTile
        label="Carried over"
        value={issuesAndPoints(changes.carriedOverIssues, changes.carriedOverPoints)}
      />
      <MetricTile
        label="Added after the start"
        value={`${share(changes.addedIssues, changes.scopeIssues)} of issues, ${share(
          changes.addedPoints,
          changes.scopePoints,
        )} of points`}
      />
    </div>
  );
}
