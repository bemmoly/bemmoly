import { useRecordRecent } from '@bemmoly/core-web';
import { quarterOf, quarterRefSchema, type QuarterRef } from '@bemmoly/module-work/shared';
import { Select } from '@bemmoly/ui';
import { workPaths } from '../hooks/issue-navigation.ts';
import { IssueSlideOver } from '../issue/index.ts';
import { ReportSection } from '../reports/report-card.tsx';
import { ReportsError, ReportsSkeleton } from '../reports/reports-empty.tsx';
import type { WorkScreenProps } from '../routes.tsx';
import { useProject, useWorkRealtime } from '../shared/index.ts';
import { useIssuePeek } from '../shared/issue-peek.ts';
import { setSearchParams, useSearchParam } from '../shared/url-state.ts';
import { quarterChoices, quarterLabel, useQuarterReport } from './model.ts';
import {
  QuarterBurnupCard,
  QuarterEpicsCard,
  QuarterSprintsCard,
  QuarterTiles,
} from './quarter-parts.tsx';

/*
 * The quarter view (docs/design/premium/interaction/dashboards.md): one project's progress
 * over a calendar quarter, for teams that plan by the quarter. The quarter lives in the
 * address; an epic opens in the peek.
 */
export default function QuarterScreen({ projectKey }: WorkScreenProps) {
  const { project, isPending } = useProject(projectKey);
  const param = useSearchParam('quarter');
  const current = quarterOf(Date.now());
  const quarter: QuarterRef = quarterRefSchema.safeParse(param).success
    ? (param as QuarterRef)
    : current;
  const report = useQuarterReport(project?.key ?? '', quarter);
  const peek = useIssuePeek(() => []);
  useWorkRealtime(project?.id);
  useRecordRecent(
    project
      ? {
          id: `work.quarter:${project.key}`,
          title: 'Quarter',
          context: project.name,
          path: workPaths.quarter(project.key),
          look: { kind: 'icon', icon: 'calendar', moduleId: 'work' },
          group: 'Reports',
        }
      : null,
  );

  if (isPending || (project && report.isPending)) return <ReportsSkeleton />;
  if (!project || !report.data) {
    const message = report.error
      ? `${report.error.message.replace(/\.$/, '')}.`
      : 'There is no such project.';
    return <ReportsError message={message} onRetry={() => void report.refetch()} />;
  }
  const choices = quarterChoices();
  const options = (choices.includes(quarter) ? choices : [quarter, ...choices]).map((ref) => ({
    value: ref,
    label: ref === current ? `${quarterLabel(ref)} (this quarter)` : quarterLabel(ref),
  }));

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-auto px-6 py-4 max-md:px-4">
        <h1 className="sr-only">Quarter</h1>
        <ReportSection
          title={quarterLabel(quarter)}
          controls={
            <Select
              aria-label="Quarter"
              className="w-60 max-md:w-full"
              value={quarter}
              options={options}
              onChange={(event) =>
                setSearchParams({ quarter: event.value === current ? null : event.value })
              }
            />
          }
        >
          <QuarterTiles report={report.data} />
          <div className="grid gap-4 lg:grid-cols-2">
            <QuarterBurnupCard report={report.data} error={null} />
            <QuarterSprintsCard report={report.data} />
          </div>
          <QuarterEpicsCard report={report.data} onOpenIssue={peek.open} />
        </ReportSection>
      </div>
      <IssueSlideOver issueKey={peek.issueKey} onClose={peek.close} variant="overlay" />
    </div>
  );
}
