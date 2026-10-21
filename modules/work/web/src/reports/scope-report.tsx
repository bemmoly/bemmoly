import type { ScopeKind, ScopeReport } from '@bemmoly/module-work/shared';
import { LineChart, SegmentedControl, Select } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { setSearchParams } from '../shared/url-state.ts';
import { dayLabel } from './model.ts';
import { ReportCard, ReportNote, ReportPending, ReportSection } from './report-card.tsx';
import { useScopeReport } from './use-tier-two.ts';

const KINDS = [
  { value: 'epic', label: 'Epics' },
  { value: 'version', label: 'Versions' },
] as const;

/** One epic's or version's weekly burnup, or what it says while there is none to draw. */
export function ScopeBurnupCard({
  kind,
  data,
  error,
  actions,
}: {
  kind: ScopeKind;
  data: ScopeReport | undefined;
  error: Error | null;
  actions?: ReactNode;
}) {
  return (
    <ReportCard
      title={kind === 'epic' ? 'Epic burnup' : 'Version burnup'}
      hint={data?.target ? `${data.target.label}, points by week` : undefined}
      actions={actions}
    >
      {!data ? (
        <ReportPending error={error} />
      ) : !data.target ? (
        <ReportNote>This project has no {kind} yet.</ReportNote>
      ) : (
        <LineChart
          label={`${data.target.label} burnup`}
          xLabels={data.weeks.map((week) => dayLabel(week.date))}
          series={[
            {
              id: 'scope',
              label: 'Scope',
              tone: 'ink',
              values: data.weeks.map((week) => week.scopePoints),
            },
            {
              id: 'completed',
              label: 'Completed',
              tone: 'done',
              values: data.weeks.map((week) => week.completedPoints),
            },
          ]}
        />
      )}
    </ReportCard>
  );
}

/** An epic's or version's points week by week: how its scope grew and how much of it is done. */
export function ScopeReportSection({ projectKey }: { projectKey: string }) {
  const { kind, report } = useScopeReport(projectKey);
  const data = report.data;
  return (
    <ReportSection
      title="Epics and versions"
      controls={
        <>
          <SegmentedControl
            aria-label="Epics or versions"
            size="sm"
            options={KINDS.map((item) => ({ value: item.value, label: item.label }))}
            value={kind}
            onChange={(value) =>
              setSearchParams({ scope: value === 'epic' ? null : value, target: null })
            }
          />
          {data?.target && (
            <Select
              aria-label={kind === 'epic' ? 'Epic' : 'Version'}
              className="w-60 max-md:w-full"
              value={data.target.id}
              options={data.targets.map((item) => ({
                value: item.id,
                label: item.done ? `${item.label} (done)` : item.label,
              }))}
              onChange={(event) => setSearchParams({ target: event.value })}
            />
          )}
        </>
      }
    >
      <ScopeBurnupCard kind={kind} data={data} error={report.error} />
    </ReportSection>
  );
}
