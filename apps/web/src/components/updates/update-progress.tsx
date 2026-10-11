import type {
  UpdateProgress,
  UpdateProgressStepId,
  UpdateProgressStepStatus,
} from '@bemmoly/shared';
import { Button, Modal, Spinner } from '@bemmoly/ui';
import { Notice } from '../form.tsx';
import { StatusCircle } from '../setup/health-list.tsx';
import { CommandBlock } from './release-card.tsx';

const LABELS: Record<UpdateProgressStepId, (target: string) => string> = {
  backup: () => 'Back up the database and files',
  pull: (target) => `Download ${target}`,
  verify: () => 'Check the signature',
  swap: () => 'Start the new version',
  health: () => 'Wait for it to answer',
  updater: () => 'Update the updater',
};

const SPOKEN: Record<UpdateProgressStepStatus, string> = {
  pending: 'Not started',
  running: 'In progress',
  done: 'Done',
  failed: 'Failed',
  skipped: 'Skipped',
};

/** Before the first answer from the server: the backup is about to start. */
const STARTING: UpdateProgress['steps'] = (
  ['backup', 'pull', 'verify', 'swap', 'health', 'updater'] as const
).map((id, index) => ({ id, status: index === 0 ? 'running' : 'pending' }));

function StepMark({ status }: { status: UpdateProgressStepStatus }) {
  if (status === 'running') {
    return (
      <span className="flex size-4 shrink-0 items-center justify-center text-acc">
        <Spinner size={14} />
        <span className="sr-only">{SPOKEN.running}</span>
      </span>
    );
  }
  const circle = status === 'done' ? 'ok' : status === 'skipped' ? 'warning' : status;
  return <StatusCircle status={circle} label={SPOKEN[status]} />;
}

interface StepListProps {
  target: string;
  steps: UpdateProgress['steps'];
  /** Shown under the step that runs or failed: the updater's own words. */
  detail: string | null;
}

function StepList({ target, steps, detail }: StepListProps) {
  return (
    <ol aria-label="Update steps" className="m-0 flex list-none flex-col p-0">
      {steps.map((step) => {
        const active = step.status === 'running' || step.status === 'failed';
        return (
          <li
            key={step.id}
            className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 border-t border-line py-2 text-13 first:border-t-0"
          >
            <StepMark status={step.status} />
            <span
              className={`min-w-0 flex-1 ${step.status === 'pending' ? 'text-tx-3' : 'text-tx'} ${active ? 'font-medium' : ''}`}
            >
              {LABELS[step.id](target)}
            </span>
            {active && detail ? (
              <span className="basis-full pl-6.5 text-12 leading-body break-words text-tx-3">
                {detail}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

interface UpdateProgressModalProps {
  /** The version being installed, known before the server's first answer. */
  target: string;
  from: string;
  progress: UpdateProgress | null;
  /** The app stopped answering: the new version is starting. */
  restarting: boolean;
  onClose: () => void;
}

function titleOf(progress: UpdateProgress | null, target: string): string {
  switch (progress?.outcome) {
    case 'succeeded':
      return `Updated to ${target}`;
    case 'rolled_back':
      return 'The update was rolled back';
    case 'failed':
      return 'The update did not finish';
    default:
      return `Updating to ${target}`;
  }
}

function detailOf(progress: UpdateProgress | null, restarting: boolean, from: string) {
  if (progress?.rollingBack)
    return `The new version did not answer, so Bemmoly is going back to ${from}.`;
  if (restarting) return 'Bemmoly is restarting. This page reloads itself when it answers again.';
  return progress?.message ?? null;
}

/**
 * The Update dialog once the update runs: the six steps with live status, the updater's own
 * words under the current step, and how it ended. Every admin on Settings › Updates sees it
 * while an update runs; closing it never stops the update.
 */
export function UpdateProgressModal({
  target,
  from,
  progress,
  restarting,
  onClose,
}: UpdateProgressModalProps) {
  const outcome = progress?.outcome ?? 'running';
  const steps = progress?.steps ?? STARTING;
  const current = steps.find((step) => step.status === 'running');
  const updaterKept = outcome === 'succeeded' && steps.at(-1)?.status === 'skipped';
  return (
    <Modal
      open
      onClose={onClose}
      width="md"
      title={titleOf(progress, target)}
      description={
        outcome === 'running'
          ? `From ${from}. The update keeps running if you close this.`
          : `From ${from}.`
      }
      footer={
        outcome === 'running' ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-3.5">
        <StepList
          target={target}
          steps={steps}
          detail={outcome === 'running' ? detailOf(progress, restarting, from) : null}
        />
        <p aria-live="polite" className="sr-only">
          {current ? `${LABELS[current.id](target)}: in progress` : titleOf(progress, target)}
        </p>
        {outcome === 'succeeded' ? (
          <Notice>Bemmoly {target} is running. Rolling back stays available for seven days.</Notice>
        ) : null}
        {updaterKept ? (
          <div className="flex flex-col gap-2">
            <Notice tone="caution">
              The updater stays on its current version, so its own fixes arrive later. Updates and
              rollbacks still work. To move it now, run this on the server:
            </Notice>
            <CommandBlock command="sudo bemmoly sync-updater" />
          </div>
        ) : null}
        {outcome === 'rolled_back' ? (
          <Notice tone="caution">
            {target} did not start, so {from} is running again. Nothing was lost.
          </Notice>
        ) : null}
        {outcome === 'failed' ? (
          <div
            role="alert"
            className="flex flex-col gap-1 rounded-control border border-red bg-side px-3 py-2.5 text-13 leading-body text-red-tx"
          >
            <span>
              {from} kept running and nothing was lost. Fix the cause below, then try again.
            </span>
          </div>
        ) : null}
        {outcome !== 'running' && progress?.message ? (
          <p className="m-0 text-12 leading-body break-words text-tx-3">{progress.message}</p>
        ) : null}
      </div>
    </Modal>
  );
}
