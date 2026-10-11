import { z } from 'zod';
import type { UpdaterStatus, UpdaterStep } from './updater.ts';

/**
 * The steps the Update dialog shows, in order. The updater records finer steps (it tags the
 * changelog just before the swap, and rolls back or restores after a failed health check);
 * they fold into these six.
 */
export const UPDATE_PROGRESS_STEPS = [
  'backup',
  'pull',
  'verify',
  'swap',
  'health',
  'updater',
] as const;

export const updateProgressStepIdSchema = z.enum(UPDATE_PROGRESS_STEPS);
export const updateProgressStepStatusSchema = z.enum([
  'pending',
  'running',
  'done',
  'failed',
  'skipped',
]);

export const updateProgressSchema = z.object({
  /** The version being installed; null while an updater that predates it is running. */
  target: z.string().nullable(),
  /** The version the update started from. */
  from: z.string().nullable(),
  startedAt: z.iso.datetime().nullable(),
  outcome: z.enum(['running', 'succeeded', 'rolled_back', 'failed']),
  /** The new version failed its health check and the previous one is being started again. */
  rollingBack: z.boolean(),
  /** The updater's own words for the current step or the end result. */
  message: z.string().nullable(),
  steps: z.array(
    z.object({ id: updateProgressStepIdSchema, status: updateProgressStepStatusSchema }),
  ),
});

export type UpdateProgressStepId = z.infer<typeof updateProgressStepIdSchema>;
export type UpdateProgressStepStatus = z.infer<typeof updateProgressStepStatusSchema>;
export type UpdateProgress = z.infer<typeof updateProgressSchema>;

const STEP_OF: Record<UpdaterStep, UpdateProgressStepId | null> = {
  backup: 'backup',
  pull: 'pull',
  verify: 'verify',
  tag: 'swap',
  swap: 'swap',
  health: 'health',
  updater: 'updater',
  rollback: 'health',
  restore: 'health',
  done: null,
};

type Steps = UpdateProgress['steps'];

/** Every step before `at` done, `at` itself in `status`, every later one `rest`. */
function stepsAt(
  at: UpdateProgressStepId,
  status: UpdateProgressStepStatus,
  rest: UpdateProgressStepStatus = 'pending',
): Steps {
  const index = UPDATE_PROGRESS_STEPS.indexOf(at);
  return UPDATE_PROGRESS_STEPS.map((id, i) => ({
    id,
    status: i < index ? 'done' : i === index ? status : rest,
  }));
}

function finished(status: UpdaterStatus): UpdateProgress | null {
  const last = status.history[0];
  if (last?.operation !== 'update') return null;
  if (status.target && last.to !== status.target) return null;
  if (status.startedAt && last.at < status.startedAt) return null;
  const base = {
    target: last.to,
    from: last.from,
    startedAt: status.startedAt,
    rollingBack: false,
    message: status.message ?? last.message,
  };
  if (last.outcome === 'succeeded') {
    const self = status.selfUpdate?.to === last.to ? status.selfUpdate : null;
    const updater: UpdateProgressStepStatus = self?.outcome === 'updated' ? 'done' : 'skipped';
    return { ...base, outcome: 'succeeded', steps: stepsAt('updater', updater) };
  }
  if (last.outcome === 'rolled_back') {
    return { ...base, outcome: 'rolled_back', steps: stepsAt('health', 'failed', 'skipped') };
  }
  const at = (status.step && STEP_OF[status.step]) || 'backup';
  return { ...base, outcome: 'failed', steps: stepsAt(at, 'failed') };
}

/**
 * The Update dialog's view of the updater's state file: which step runs, which are done, and
 * how the last update ended. Null when the state says nothing about an update (no update yet,
 * or a rollback is the latest operation).
 */
export function deriveUpdateProgress(status: UpdaterStatus): UpdateProgress | null {
  if (status.state === 'running') {
    if (status.operation !== 'update') return null;
    const step = status.step ? STEP_OF[status.step] : 'backup';
    const rollingBack = status.step === 'rollback' || status.step === 'restore';
    return {
      target: status.target,
      from: status.target && status.current === status.target ? status.previous : status.current,
      startedAt: status.startedAt,
      outcome: 'running',
      rollingBack,
      message: status.message,
      steps: rollingBack
        ? stepsAt('health', 'failed', 'skipped')
        : stepsAt(step ?? 'updater', step ? 'running' : 'done'),
    };
  }
  return finished(status);
}
