import { useRecordRecent } from '@bemmoly/core-web';
import { SegmentedControl, Select } from '@bemmoly/ui';
import { workPaths } from '../hooks/issue-navigation.ts';
import { useAiEnabled } from '../issue/issue-ai-summary.tsx';
import { IssueSlideOver } from '../issue/index.ts';
import type { WorkScreenProps } from '../routes.tsx';
import { useWorkRealtime } from '../shared/index.ts';
import { useIssuePeek } from '../shared/issue-peek.ts';
import { setSearchParams } from '../shared/url-state.ts';
import { FlowReports } from './flow-reports.tsx';
import { RANGE_LABELS, RANGES } from './model.ts';
import { ControlChartCard, TimeInStatusCard } from './cycle-reports.tsx';
import { ReportSection } from './report-card.tsx';
import { NoSprints, ReportsError, ReportsSkeleton } from './reports-empty.tsx';
import { AskReport } from './ask-report.tsx';
import { PinnedReports } from './pinned-reports.tsx';
import { ScopeReportSection } from './scope-report.tsx';
import { SprintReports } from './sprint-reports.tsx';
import { StatsSection } from './stats-section.tsx';
import { TimeTrackingSection } from './time-tracking-section.tsx';
import { useReports } from './use-reports.ts';
import { useCycleReports } from './use-tier-two.ts';

/*
 * The Reports view (docs/design/premium/interaction/reports.md), in three sections: the
 * sprint (burndown, burnup, report, velocity), the project's flow over a range (cumulative
 * flow, created vs resolved, control chart, time in status) and an epic's or version's burnup.
 * Each section's choice lives in the address; an issue in the sprint report opens in the peek.
 * Above them, with AI on, a question box builds a report on request, and the person's pinned
 * reports come first.
 */
export default function ReportsScreen({ projectKey }: WorkScreenProps) {
  const reports = useReports(projectKey);
  const { project, sprint, sprints, range } = reports;
  const cycle = useCycleReports(project?.key ?? '', Number(range));
  useWorkRealtime(project?.id);
  const peek = useIssuePeek(() => []);
  const aiEnabled = useAiEnabled();
  useRecordRecent(
    project
      ? {
          id: `work.reports:${project.key}`,
          title: 'Reports',
          context: project.name,
          path: workPaths.reports(project.key),
          look: { kind: 'icon', icon: 'reports', moduleId: 'work' },
          group: 'Reports',
        }
      : null,
  );

  if (reports.pending) return <ReportsSkeleton />;
  if (!project || reports.error || !reports.flow) {
    const message = reports.error
      ? `${reports.error.message.replace(/\.$/, '')}.`
      : 'There is no such project.';
    return <ReportsError message={message} onRetry={reports.retry} />;
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col gap-8 overflow-auto px-6 py-4 max-md:px-4">
        <h1 className="sr-only">Reports</h1>
        {aiEnabled && <AskReport projectKey={project.key} />}
        <PinnedReports projectKey={project.key} />
        <ReportSection
          title="Sprint"
          controls={
            sprint && (
              <Select
                aria-label="Sprint"
                className="w-60 max-md:w-full"
                value={sprint.id}
                options={sprints.map((item) => ({
                  value: item.id,
                  label: item.state === 'active' ? `${item.name} (active)` : item.name,
                }))}
                onChange={(event) =>
                  setSearchParams({ sprint: event.value === sprints[0]?.id ? null : event.value })
                }
              />
            )
          }
        >
          {reports.sprintReport ? (
            <SprintReports report={reports.sprintReport} onOpenIssue={peek.open} />
          ) : (
            <NoSprints />
          )}
        </ReportSection>
        <ReportSection
          title="Flow"
          controls={
            <SegmentedControl
              aria-label="Flow range"
              size="sm"
              options={RANGES.map((value) => ({ value, label: RANGE_LABELS[value] }))}
              value={range}
              onChange={(value) => setSearchParams({ range: value === '30' ? null : value })}
            />
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <FlowReports report={reports.flow} />
            <ControlChartCard chart={cycle.control.data} error={cycle.control.error} />
            <TimeInStatusCard report={cycle.timeInStatus.data} error={cycle.timeInStatus.error} />
          </div>
        </ReportSection>
        <TimeTrackingSection
          projectKey={project.key}
          days={Number(range)}
          onOpenIssue={peek.open}
        />
        <StatsSection projectKey={project.key} />
        <ScopeReportSection projectKey={project.key} />
      </div>
      <IssueSlideOver issueKey={peek.issueKey} onClose={peek.close} variant="overlay" />
    </div>
  );
}
