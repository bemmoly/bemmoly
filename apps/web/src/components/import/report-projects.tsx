import { Button, SettingsSection, SkeletonText } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId, useState } from 'react';
import { rowSummary, type ImportReportView } from '../../hooks/use-import-report.ts';
import type { RunRow } from '../../hooks/use-import-run.ts';
import { FormError } from '../form.tsx';
import { RouterLink } from '../router-link.tsx';
import { RunRowLine } from './run-row.tsx';
import { DisclosureButton } from './disclosure-button.tsx';
import { RunRowsMore } from './run-rows-more.tsx';
import { count } from './import-words.ts';

/** Rows shown before "Show N more". */
const FIRST = 5;

interface ReportProjectsProps {
  report: ImportReportView;
  retrying: boolean;
  onRetry: (ids: string[]) => void;
}

function ProjectRow({ row, report, retrying, onRetry }: ReportProjectsProps & { row: RunRow }) {
  const { nouns } = report;
  const { status, done, total, error, path } = row.progress;
  const failed = status === 'failed';
  const open = nouns.container === 'space' ? 'Open space' : 'Open board';
  return (
    <RunRowLine
      row={row}
      detail={
        failed
          ? `Stopped at ${count(done)} of ${count(total)}${error ? `: ${error}` : ''}`
          : rowSummary(row, nouns.records)
      }
    >
      {failed ? (
        <Button
          size="sm"
          icon={<Icon name="refresh" />}
          loading={retrying}
          onClick={() => onRetry([row.id])}
        >
          Retry<span className="sr-only"> {row.name}</span>
        </Button>
      ) : path ? (
        <RouterLink
          href={path}
          className="shrink-0 rounded-chip text-13 font-medium text-acc hover:underline focus-ring"
        >
          {open}
          <span className="sr-only"> for {row.name}</span>
        </RouterLink>
      ) : null}
    </RunRowLine>
  );
}

/** One row per project or space: the failed ones first with Retry, the rest with Open board. */
export function ReportProjects(props: ReportProjectsProps) {
  const { report } = props;
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (!report.loading && report.rows.length === 0 && !report.error) return null;
  const shown = open ? report.rows : report.rows.slice(0, FIRST);
  const more = Math.max(report.rowsTotal, report.rows.length) - FIRST;
  const title = report.nouns.containers.charAt(0).toUpperCase() + report.nouns.containers.slice(1);
  return (
    <SettingsSection title={title} hint={count(report.rowsTotal)}>
      <FormError error={report.error} />
      {report.loading ? (
        <SkeletonText lines={3} />
      ) : (
        <div className="flex flex-col gap-2">
          <ul id={listId} aria-label={title} className="m-0 list-none p-0">
            {shown.map((row) => (
              <ProjectRow key={row.id} row={row} {...props} />
            ))}
          </ul>
          {more > 0 ? (
            <DisclosureButton expanded={open} controls={listId} onToggle={() => setOpen(!open)}>
              {open ? 'Show fewer' : `Show ${count(more)} more`}
            </DisclosureButton>
          ) : null}
          {open && report.hasMore ? (
            <RunRowsMore
              left={report.rowsTotal - report.rows.length}
              loading={report.loadingMore}
              onMore={report.loadMore}
            />
          ) : null}
        </div>
      )}
    </SettingsSection>
  );
}
