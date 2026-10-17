import type { ImportJob, ImportSource } from '@bemmoly/shared';
import { Button, buttonClassName, SettingsSection } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useImportReport } from '../../hooks/use-import-report.ts';
import { importsApi } from '../../lib/imports-api.ts';
import { FormError, Notice } from '../form.tsx';
import { count } from './import-words.ts';
import { ReportProjects } from './report-projects.tsx';
import { ReportStats } from './report-stats.tsx';
import { ResultAlert } from './result-alert.tsx';

interface ImportReportProps {
  job: ImportJob;
  source: ImportSource | null;
  rerunning: boolean;
  error: unknown;
  onRerun: () => void;
  onRetry: (containers: string[]) => void;
  onStartOver: () => void;
}

/**
 * Done: how it ended (with Retry for what stopped), the totals, one row per project or space,
 * the first skipped records with the whole list as CSV, then New import and Run again.
 */
export function ImportReport(props: ImportReportProps) {
  const { job, rerunning } = props;
  const report = useImportReport(job, props.source);
  const { result, failed } = report;
  const retryAll =
    failed.length > 0 ? (
      <Button
        variant="primary"
        size="sm"
        icon={<Icon name="refresh" />}
        loading={rerunning}
        onClick={() => props.onRetry(report.failedIds)}
      >
        {failed.length === 1 ? `Retry ${failed[0]?.name ?? ''}` : `Retry ${count(failed.length)}`}
      </Button>
    ) : null;
  const more = job.report.skippedTotal - job.report.skipped.length;
  return (
    <div className="flex flex-col gap-4">
      <ResultAlert tone={result.tone} headline={result.headline} action={retryAll}>
        {result.body}
      </ResultAlert>
      <ReportStats stats={report.stats} />
      <ReportProjects report={report} retrying={rerunning} onRetry={props.onRetry} />
      {job.report.warnings.map((warning) => (
        <Notice key={warning} tone="caution">
          {warning}
        </Notice>
      ))}
      <SettingsSection
        title="Skipped"
        hint={`${count(job.report.skippedTotal)} ${job.report.skippedTotal === 1 ? 'record' : 'records'}`}
      >
        {job.report.skipped.length > 0 ? (
          <ul className="m-0 flex list-none flex-col p-0 text-13">
            {job.report.skipped.map((skip) => (
              <li
                key={`${skip.kind}:${skip.source}`}
                className="flex flex-wrap gap-x-3 border-t border-line-2 py-2 first:border-t-0"
              >
                <span className="w-28 shrink-0 font-mono text-12 text-tx-2">{skip.source}</span>
                <span className="min-w-0 flex-1 text-tx">{skip.reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-13 text-tx-2">Nothing was skipped.</p>
        )}
        {more > 0 ? (
          <p className="m-0 text-12 text-tx-3">and {count(more)} more in the list</p>
        ) : null}
        <FormError error={props.error} />
        <div className="-mx-4 -mb-4 flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          {job.report.skippedTotal > 0 ? (
            <a href={importsApi.skipsUrl(job.id)} download className={buttonClassName({})}>
              <Icon name="download" />
              Download the list (CSV)
            </a>
          ) : null}
          <span className="ms-auto flex flex-wrap gap-2">
            <Button variant="ghost" icon={<Icon name="plus" />} onClick={props.onStartOver}>
              New import
            </Button>
            <Button icon={<Icon name="refresh" />} loading={rerunning} onClick={props.onRerun}>
              {report.canResume ? 'Resume' : 'Run again'}
            </Button>
          </span>
        </div>
      </SettingsSection>
    </div>
  );
}
