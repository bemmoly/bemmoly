import type { RollbackPlan, UpdatesOverview } from '@bemmoly/shared';
import { Button, Modal } from '@bemmoly/ui';
import { rollbackCopy, updateModeCopy } from '../../hooks/use-updates-copy.ts';
import { LINK_ACTION } from '../actions.ts';
import { FormError, Notice } from '../form.tsx';
import { CommandBlock, NotesLink, ReleaseWarnings } from './release-card.tsx';

interface UpdateModalProps {
  overview: UpdatesOverview;
  busy: boolean;
  error: unknown;
  /** The server has no updater after all: run this instead. */
  cliCommand: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function UpdateModal({
  overview,
  busy,
  error,
  cliCommand,
  onClose,
  onConfirm,
}: UpdateModalProps) {
  const release = overview.available;
  if (!release) return null;
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={`Update to ${release.version}?`}
      description={`From ${overview.current.version}, on the ${overview.current.channel} channel.`}
      footer={
        <>
          <Button onClick={onClose}>{cliCommand ? 'Close' : 'Cancel'}</Button>
          {cliCommand ? null : (
            <Button variant="primary" loading={busy} onClick={onConfirm}>
              Update to {release.version}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <NotesLink release={release} />
        <ReleaseWarnings release={release} />
        {cliCommand ? (
          <>
            <p className="m-0 text-13 leading-body text-tx">{updateModeCopy('cli')}</p>
            <CommandBlock command={cliCommand} />
          </>
        ) : (
          <p className="m-0 text-13 leading-body text-tx">{updateModeCopy('in_app')}</p>
        )}
        <FormError error={error} />
      </div>
    </Modal>
  );
}

interface RollbackModalProps {
  plan: RollbackPlan;
  busy: boolean;
  error: unknown;
  planChanged: boolean;
  /** The CSV of audit rows a restore rollback would discard. */
  exportUrl: (since: string) => string;
  onClose: () => void;
  onConfirm: () => void;
}

export function RollbackModal({
  plan,
  busy,
  error,
  planChanged,
  exportUrl,
  onClose,
  onConfirm,
}: RollbackModalProps) {
  const copy = rollbackCopy(plan);
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={`Roll back to ${plan.toVersion}?`}
      description={copy.mode}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant={plan.mode === 'restore' ? 'danger' : 'primary'}
            loading={busy}
            onClick={onConfirm}
          >
            Roll back to {plan.toVersion}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        {planChanged ? (
          <Notice tone="caution">
            The rollback plan changed since this dialog opened. Read the new plan below, then
            confirm again.
          </Notice>
        ) : null}
        <p className="m-0 text-13 leading-body text-tx">{copy.summary}</p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-13 leading-body text-tx">
          {copy.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {copy.exportSince ? (
          <a className={`text-13 ${LINK_ACTION}`} href={exportUrl(copy.exportSince)} download>
            Export the audit rows for those changes first
          </a>
        ) : null}
        {planChanged ? null : <FormError error={error} />}
      </div>
    </Modal>
  );
}
