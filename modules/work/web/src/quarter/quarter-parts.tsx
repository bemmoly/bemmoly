import type { QuarterReport } from '@bemmoly/module-work/shared';
import { BarChart, LineChart, ProgressBar, StatTile } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { dayLabel } from '../reports/model.ts';
import { ReportCard, ReportNote, ReportPending } from '../reports/report-card.tsx';
import { epicProgress, quarterLabel, quarterTotals } from './model.ts';

/*
 * The parts of the quarter view: the headline figures, the burnup over its weeks, its sprints
 * and its epics. The view draws them all; the dashboard widget draws the burnup.
 */

interface Props {
  report: QuarterReport;
}

/** One line of where the quarter stands, for a card's hint. */
export function quarterHint(report: QuarterReport) {
  const totals = quarterTotals(report);
  return `${quarterLabel(report.quarter)}: ${totals.done}% done, ${totals.elapsed}% of the quarter gone`;
}

export function QuarterTiles({ report }: Props) {
  const totals = quarterTotals(report);
  return (
    <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2">
      <StatTile
        label="Completed"
        value={`${totals.done}%`}
        detail={`${totals.completed} of ${totals.scope} ${totals.unit}`}
        detailTone={totals.done >= totals.elapsed ? 'better' : 'worse'}
      />
      <StatTile
        label="Quarter gone"
        value={`${totals.elapsed}%`}
        detail={`${dayLabel(report.from)} to ${dayLabel(report.to)}`}
      />
      <StatTile
        label="Issues finished"
        value={totals.completedIssues}
        detail={`of ${totals.scopeIssues} in scope`}
      />
      <StatTile
        label="Sprints"
        value={report.sprints.length}
        detail={`${report.sprints.filter((sprint) => sprint.state === 'closed').length} closed`}
      />
    </div>
  );
}

export function QuarterBurnup({ report }: Props) {
  const { byPoints } = quarterTotals(report);
  if (report.weeks.length === 0) return <ReportNote>This quarter has not started yet.</ReportNote>;
  return (
    <LineChart
      label={`${quarterLabel(report.quarter)} burnup`}
      xLabels={report.weeks.map((week) => dayLabel(week.date))}
      series={[
        {
          id: 'scope',
          label: 'Scope',
          tone: 'ink',
          values: report.weeks.map((week) => (byPoints ? week.scopePoints : week.scopeIssues)),
        },
        {
          id: 'completed',
          label: 'Completed',
          tone: 'done',
          values: report.weeks.map((week) =>
            byPoints ? week.completedPoints : week.completedIssues,
          ),
        },
      ]}
    />
  );
}

/** The burnup as a card, the dashboard widget's whole body and the view's first chart. */
export function QuarterBurnupCard({
  report,
  error,
  actions,
}: {
  report: QuarterReport | undefined;
  error: Error | null;
  actions?: ReactNode;
}) {
  return (
    <ReportCard
      title="Quarter"
      hint={report ? quarterHint(report) : 'Scope and completed work by week'}
      actions={actions}
    >
      {report ? <QuarterBurnup report={report} /> : <ReportPending error={error} />}
    </ReportCard>
  );
}

export function QuarterSprintsCard({ report }: Props) {
  return (
    <ReportCard title="Sprints" hint="Committed and completed points in each sprint">
      {report.sprints.length === 0 ? (
        <ReportNote>No sprint runs in this quarter.</ReportNote>
      ) : (
        <BarChart
          label="Sprints in the quarter"
          xLabels={report.sprints.map((sprint) => sprint.name)}
          series={[
            {
              id: 'committed',
              label: 'Committed',
              tone: 'todo',
              values: report.sprints.map((sprint) => sprint.committedPoints),
            },
            {
              id: 'completed',
              label: 'Completed',
              tone: 'done',
              values: report.sprints.map((sprint) => sprint.completedPoints),
            },
          ]}
        />
      )}
    </ReportCard>
  );
}

export function QuarterEpicsCard({
  report,
  onOpenIssue,
}: Props & { onOpenIssue: (key: string) => void }) {
  return (
    <ReportCard title="Epics" hint="Open epics and those with work finished this quarter">
      {report.epics.length === 0 ? (
        <ReportNote>No epic has work in this quarter.</ReportNote>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {report.epics.map((epic) => (
            <li
              key={epic.epicId}
              className="flex items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onOpenIssue(epic.key)}
                className="w-20 shrink-0 cursor-pointer text-left text-13 font-medium text-tx-2 tabular-nums hover:text-tx"
              >
                {epic.key}
              </button>
              <span className="min-w-0 flex-1 truncate text-13 text-tx" title={epic.title}>
                {epic.title}
              </span>
              <span className="text-12 text-tx-3 tabular-nums max-md:hidden">
                {epic.completedInQuarter} finished this quarter
              </span>
              <ProgressBar
                value={epicProgress(epic)}
                label={`${epic.key} progress`}
                className="w-30"
              />
              <span className="w-10 text-right text-12 text-tx-2 tabular-nums">
                {epicProgress(epic)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </ReportCard>
  );
}
