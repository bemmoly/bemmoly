import type { ImportJob } from '@bemmoly/shared';
import { Button, ProgressBar, SettingsSection } from '@bemmoly/ui';
import { StatePill } from '../settings/state-pill.tsx';
import { count, STATUS_WORDS } from './import-words.ts';

interface RunProgressProps {
  job: ImportJob;
  cancelling: boolean;
  onCancel: () => void;
}

/** A running import: the step it is on, a bar, done of total, and Cancel. */
export function RunProgress({ job, cancelling, onCancel }: RunProgressProps) {
  const { done, total } = job.progress;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const words = STATUS_WORDS[job.status];
  return (
    <SettingsSection
      title={`Importing from ${job.sourceLabel}`}
      actions={
        <Button size="sm" loading={cancelling} onClick={onCancel}>
          Cancel import
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatePill tone={words.tone} stage="progress">
          {words.label}
        </StatePill>
        <span aria-live="polite" className="text-13 text-tx-2">
          {job.phase ? `${job.phase}: ` : ''}
          <span className="tabular-nums">
            {count(done)} of {count(total)}
          </span>
        </span>
      </div>
      <ProgressBar value={pct} size="md" fillClassName="bg-acc-fill" label="Import progress" />
      <p className="m-0 text-12 text-tx-3">
        You can leave this page; the import keeps running and its report waits under Recent imports.
        Cancel stops after the current record, and Resume picks up from there.
      </p>
    </SettingsSection>
  );
}
