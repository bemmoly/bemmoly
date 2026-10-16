import type { TimeTrackingReport } from '@bemmoly/module-work/shared';
import { BarChart } from '@bemmoly/ui';
import { useId, type ReactNode } from 'react';
import { dayLabel, points } from './model.ts';
import { ReportCard, ReportNote, ReportPending, ReportSection } from './report-card.tsx';
import { useTimeTracking } from './use-time-tracking.ts';

/** Minutes as hours to one decimal: logs are entered in minutes, read in hours. */
export const hours = (minutes: number) => `${(Math.round(minutes / 6) / 10).toFixed(1)} h`;

function ListHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="m-0 mb-1 text-13 font-semibold text-tx">
      {children}
    </h3>
  );
}

function People({ people }: { people: TimeTrackingReport['people'] }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="min-w-0">
      <ListHeading id={id}>People</ListHeading>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {people.map((person) => (
          <li key={person.userId} className="flex items-center gap-3 px-2 py-1.5 text-13 text-tx">
            <span className="min-w-0 flex-1 truncate">{person.name}</span>
            <span className="shrink-0 text-12 text-tx-2">{hours(person.minutes)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Issues({
  issues,
  onOpenIssue,
}: {
  issues: TimeTrackingReport['issues'];
  onOpenIssue: (key: string) => void;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="min-w-0">
      <ListHeading id={id}>Top issues</ListHeading>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {issues.map((issue) => (
          <li key={issue.issueId}>
            <button
              type="button"
              onClick={() => onOpenIssue(issue.key)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent px-2 py-1.5 text-left text-13 text-tx hover:bg-hover focus-ring"
            >
              <span className="shrink-0 font-mono text-12 text-tx-2">{issue.key}</span>
              <span className="min-w-0 flex-1 truncate">{issue.title}</span>
              <span className="shrink-0 text-12 text-tx-3">{points(issue.estimate)}</span>
              <span className="shrink-0 text-12 text-tx-2">{hours(issue.minutes)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Where the logged time went over the flow range: by week, by person and by issue. */
export function TimeTrackingSection({
  projectKey,
  days,
  onOpenIssue,
}: {
  projectKey: string;
  days: number;
  onOpenIssue: (key: string) => void;
}) {
  const report = useTimeTracking(projectKey, days);
  const data = report.data;
  return (
    <ReportSection title="Time tracking">
      <ReportCard
        title="Logged time"
        hint={data && data.totalMinutes > 0 ? `${hours(data.totalMinutes)} in total` : undefined}
      >
        {!data ? (
          <ReportPending error={report.error} />
        ) : data.totalMinutes === 0 ? (
          <ReportNote>No time was logged in this range.</ReportNote>
        ) : (
          <div className="flex flex-col gap-4">
            <BarChart
              label="Hours logged per week"
              xLabels={data.weeks.map((week) => dayLabel(week.date))}
              series={[
                {
                  id: 'hours',
                  label: 'Hours',
                  tone: 'prog',
                  values: data.weeks.map((week) => Math.round(week.minutes / 6) / 10),
                },
              ]}
            />
            <div className="grid grid-cols-[1fr_2fr] gap-6 max-md:grid-cols-1">
              <People people={data.people} />
              <Issues issues={data.issues} onOpenIssue={onOpenIssue} />
            </div>
          </div>
        )}
      </ReportCard>
    </ReportSection>
  );
}
