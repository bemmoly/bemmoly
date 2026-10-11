import type { ImportJob } from '@bemmoly/shared';
import { Button, SettingsSection } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { FormError, Notice } from '../form.tsx';
import { StatePill } from '../settings/state-pill.tsx';
import { count, kindLabel, STATUS_WORDS } from './import-words.ts';

const CELL = 'border-b border-line-2 py-2 text-13 tabular-nums';

interface ImportReportProps {
  job: ImportJob;
  rerunning: boolean;
  error: unknown;
  onRerun: () => void;
  onStartOver: () => void;
}

/** What an import did: counts per kind, what it skipped and why, warnings, and what next. */
export function ImportReport({ job, rerunning, error, onRerun, onStartOver }: ImportReportProps) {
  const { report } = job;
  const words = STATUS_WORDS[job.status];
  const finished = job.status === 'completed';
  const rows = Object.entries(report.counts);
  const more = report.skippedTotal - report.skipped.length;
  return (
    <SettingsSection
      title={`Import from ${job.sourceLabel}`}
      actions={<StatePill tone={words.tone}>{words.label}</StatePill>}
    >
      {job.error ? <Notice tone="caution">{job.error}</Notice> : null}
      {rows.length > 0 ? (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Records per kind</caption>
          <thead>
            <tr className="text-12 font-semibold text-tx-3">
              <th className={`${CELL} font-semibold`}>Kind</th>
              <th className={`${CELL} text-right font-semibold`}>Created</th>
              <th className={`${CELL} text-right font-semibold`}>Updated</th>
              <th className={`${CELL} text-right font-semibold`}>Skipped</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([kind, n]) => (
              <tr key={kind} className="text-tx">
                <th scope="row" className={`${CELL} font-medium`}>
                  {kindLabel(kind)}
                </th>
                <td className={`${CELL} text-right`}>{count(n.created)}</td>
                <td className={`${CELL} text-right`}>{count(n.updated)}</td>
                <td className={`${CELL} text-right`}>{count(n.skipped)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="m-0 text-13 text-tx-2">Nothing was brought in before it stopped.</p>
      )}
      {report.skipped.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="m-0 text-12 font-semibold text-tx-3">Skipped</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-13">
            {report.skipped.map((skip) => (
              <li key={`${skip.kind}:${skip.source}`} className="text-tx-2">
                <span className="font-medium text-tx">{skip.source}</span> · {skip.reason}
              </li>
            ))}
          </ul>
          {more > 0 ? <p className="m-0 text-12 text-tx-3">and {count(more)} more</p> : null}
        </div>
      ) : null}
      {report.warnings.map((warning) => (
        <Notice key={warning} tone="caution">
          {warning}
        </Notice>
      ))}
      <FormError error={error} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="m-0 flex-1 text-12 text-tx-3">
          {finished
            ? 'Running it again updates what this import made instead of adding copies.'
            : 'Resume carries on from where it stopped; nothing already brought in is repeated.'}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" icon={<Icon name="plus" />} onClick={onStartOver}>
            New import
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="refresh" />}
            loading={rerunning}
            onClick={onRerun}
          >
            {finished ? 'Run again' : 'Resume'}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
