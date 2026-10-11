import {
  UPDATE_PROGRESS_STEPS,
  type RollbackMode,
  type UpdateProgress,
  type UpdateProgressStepId,
} from '@bemmoly/shared';
import { audit, type MockDb } from '../db.ts';
import { ok, type MockResponse } from '../types.ts';

/**
 * An in-app update as the real updater runs it, one phase per read of the overview: the
 * steps in order, a stretch where the app is restarting and answers nothing, the new version
 * coming up, then the updater moving itself. `fail` stops it at a step the way a refused
 * signature (verify) or a version that never answers (health) would.
 */
export interface MockUpdateJob {
  from: string;
  target: string;
  startedAt: string;
  phase: number;
  fail: 'verify' | 'health' | null;
  /** The updater could not move itself; the update still succeeds. */
  keepUpdater: boolean;
}

type Phase = UpdateProgressStepId | 'restart' | 'done';
const PHASES: readonly Phase[] = [
  'backup',
  'pull',
  'verify',
  'swap',
  'restart',
  'restart',
  'health',
  'updater',
  'updater',
  'done',
];

const MESSAGES: Record<UpdateProgressStepId, (job: MockUpdateJob) => string> = {
  backup: (job) => `Backing up before updating ${job.from} → ${job.target}`,
  pull: (job) => `Pulling ghcr.io/bemmoly/bemmoly:${job.target}`,
  verify: (job) => `Verifying the signature of ghcr.io/bemmoly/bemmoly:${job.target}`,
  swap: (job) => `Starting ${job.target}`,
  health: (job) => `Waiting for ${job.target} to answer /readyz`,
  updater: (job) => `Moving the updater to ${job.target}`,
};

export function startUpdateJob(db: MockDb, target: string): void {
  db.updateJob = {
    from: db.updates.current.version,
    target,
    startedAt: new Date().toISOString(),
    phase: 0,
    fail: db.updateJob?.fail ?? null,
    keepUpdater: db.updateJob?.keepUpdater ?? false,
  };
  db.updates.updater = { ...db.updates.updater, state: 'running', step: 'backup' };
  audit(db, 'update.started', 'system', target);
}

/** The app is down between the swap and the new version answering. */
export const restarting = (db: MockDb) => PHASES[db.updateJob?.phase ?? -1] === 'restart';

function steps(at: number, status: 'running' | 'failed' | 'done'): UpdateProgress['steps'] {
  return UPDATE_PROGRESS_STEPS.map((id, index) => ({
    id,
    status: index < at ? 'done' : index === at ? status : 'pending',
  }));
}

function finish(db: MockDb, job: MockUpdateJob, progress: UpdateProgress): void {
  const now = new Date().toISOString();
  const updates = db.updates;
  if (progress.outcome === 'succeeded') {
    const mode: RollbackMode = updates.available?.rollback === 'restore' ? 'restore' : 'code';
    updates.current = { ...updates.current, updatedAt: now, previousVersion: job.from };
    updates.rollback = {
      fromVersion: job.target,
      toVersion: job.from,
      mode,
      summary: `Swaps back to the ${job.from} image. Nothing is lost.`,
      reason: `Rollback from ${job.target} was planned when it was installed.`,
      schemaChangesets: [],
      discard: null,
      backupId: db.backups[0]?.id ?? null,
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    };
    updates.available = null;
  }
  updates.updater = {
    ...updates.updater,
    state: progress.outcome === 'failed' ? 'failed' : 'idle',
    step: progress.outcome === 'failed' ? 'verify' : null,
    progress,
    version: job.keepUpdater ? job.from : job.target,
  };
  db.updateJob = { ...job, phase: PHASES.length };
}

/** One read of Settings › Updates during the job; the job moves on a phase. */
export function readUpdateJob(db: MockDb): MockResponse | null {
  const job = db.updateJob;
  if (!job || job.phase >= PHASES.length) return null;
  const phase = PHASES[job.phase]!;
  job.phase += 1;
  if (phase === 'restart') {
    // The proxy's answer while no app container listens.
    return {
      status: 502,
      body: { code: 'unavailable', message: 'Bad gateway', requestId: 'mock' },
    };
  }
  const base = { target: job.target, from: job.from, startedAt: job.startedAt, rollingBack: false };
  const at = phase === 'done' ? UPDATE_PROGRESS_STEPS.length : UPDATE_PROGRESS_STEPS.indexOf(phase);
  if (phase !== 'done' && phase === job.fail) {
    const failed: UpdateProgress =
      phase === 'verify'
        ? {
            ...base,
            outcome: 'failed',
            message: `Signature verification failed for ghcr.io/bemmoly/bemmoly:${job.target}: no matching signatures. Refusing to update.`,
            steps: steps(at, 'failed'),
          }
        : {
            ...base,
            outcome: 'rolled_back',
            message: `${job.target} did not start; ${job.from} is running again (code rollback)`,
            steps: steps(at, 'failed').map((step) =>
              step.id === 'updater' ? { ...step, status: 'skipped' } : step,
            ),
          };
    finish(db, job, failed);
    return ok(db.updates);
  }
  if (phase === 'health') db.updates.current = { ...db.updates.current, version: job.target };
  if (phase === 'done') {
    const all = steps(at, 'done');
    if (job.keepUpdater) all[all.length - 1] = { id: 'updater', status: 'skipped' };
    finish(db, job, {
      ...base,
      outcome: 'succeeded',
      message: job.keepUpdater
        ? `Updated to ${job.target}; the updater stays on ${job.from}. Signature verification failed for ghcr.io/bemmoly/updater:${job.target}`
        : `Updated to ${job.target}; the updater moved to ${job.target} too`,
      steps: all,
    });
    db.system.version = job.target;
    return ok(db.updates);
  }
  db.updates.updater = {
    ...db.updates.updater,
    state: 'running',
    step: phase,
    progress: {
      ...base,
      outcome: 'running',
      message: MESSAGES[phase](job),
      steps: steps(at, 'running'),
    },
  };
  return ok(db.updates);
}
