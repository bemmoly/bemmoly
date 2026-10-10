import { formatBytes, formatDateTime } from '@bemmoly/core-web';
import type { Backup } from '@bemmoly/shared';
import { Button, EmptyState, Modal } from '@bemmoly/ui';
import { useState } from 'react';
import { KIND, VERIFICATION } from './backup-labels.ts';
import { StatePill } from '../settings/state-pill.tsx';

interface RestorePickerProps {
  open: boolean;
  /** Backups that finished; newest first. */
  backups: readonly Backup[];
  onClose: () => void;
  /** Goes on to the restore confirmation for the chosen backup. */
  onPick: (id: string) => void;
}

function Picker({ backups, onClose, onPick }: Omit<RestorePickerProps, 'open'>) {
  const [chosen, setChosen] = useState(backups[0]?.id ?? null);
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title="Restore a backup"
      description="Choose the backup to put back. The next step says what happens and asks you to confirm."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
            Continue
          </Button>
        </>
      }
    >
      {backups.length === 0 ? (
        <EmptyState
          title="Nothing to restore yet"
          description="A backup appears here once one finishes. Back up now to take one straight away."
        />
      ) : (
        <div role="radiogroup" aria-label="Backups" className="flex flex-col gap-1.5">
          {backups.map((backup, index) => {
            const selected = backup.id === chosen;
            const verification = VERIFICATION[backup.verification.state];
            return (
              <button
                key={backup.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setChosen(backup.id)}
                className={`flex cursor-pointer items-center gap-3 rounded-control border bg-card px-3 py-2.5 text-left font-sans text-13 outline-acc focus-visible:outline-2 focus-visible:outline-offset-1 ${selected ? 'border-acc shadow-ring' : 'border-line hover:bg-side'}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-4 shrink-0 rounded-full ${selected ? 'border-5 border-acc' : 'border border-line'}`}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium text-tx">
                    {formatDateTime(backup.createdAt)}
                    {index === 0 ? <span className="font-normal text-tx-3"> · newest</span> : null}
                  </span>
                  <span className="text-12 text-tx-3">
                    {KIND[backup.kind]} · {formatBytes(backup.sizeBytes)} · version{' '}
                    {backup.appVersion}
                  </span>
                </span>
                <StatePill tone={verification.tone}>{verification.label}</StatePill>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/** "Restore…" at the top of Storage and backups: pick a backup, then confirm it. */
export function RestorePicker({ open, ...rest }: RestorePickerProps) {
  return open ? <Picker {...rest} /> : null;
}
