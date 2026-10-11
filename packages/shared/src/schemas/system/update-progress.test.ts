import { describe, expect, it } from 'vitest';
import { deriveUpdateProgress, type UpdateProgress } from './update-progress.ts';
import { updaterStatusSchema, type UpdaterStatus, type UpdaterStep } from './updater.ts';

const AT = '2026-10-11T10:00:00.000Z';
const LATER = '2026-10-11T10:05:00.000Z';

/** An updater state file, filled the way an updater that predates `target` writes it. */
const status = (patch: Partial<UpdaterStatus> = {}): UpdaterStatus => ({
  ...updaterStatusSchema.parse({
    state: 'idle',
    operation: null,
    step: null,
    message: null,
    current: '1.2.0',
    previous: null,
    updatedAt: null,
    preUpgradeBackupId: null,
    history: [],
  }),
  ...patch,
});

const running = (step: UpdaterStep) =>
  status({ state: 'running', operation: 'update', step, target: '1.3.0', startedAt: AT });

const statuses = (progress: UpdateProgress | null) =>
  progress?.steps.map((step) => `${step.id}:${step.status}`).join(' ');

const entry = (outcome: 'succeeded' | 'rolled_back' | 'failed') => ({
  operation: 'update' as const,
  from: '1.2.0',
  to: '1.3.0',
  at: LATER,
  outcome,
  backupId: 'b1',
  mode: null,
  verification: 'verified' as const,
  message: null,
});

describe('deriveUpdateProgress', () => {
  it('reads an old state file that has no target or self-update fields', () => {
    expect(status().target).toBeNull();
    expect(deriveUpdateProgress(status())).toBeNull();
  });

  it('walks the steps in order, folding tag into swap', () => {
    expect(statuses(deriveUpdateProgress(running('backup')))).toBe(
      'backup:running pull:pending verify:pending swap:pending health:pending updater:pending',
    );
    expect(statuses(deriveUpdateProgress(running('tag')))).toBe(
      'backup:done pull:done verify:done swap:running health:pending updater:pending',
    );
    expect(statuses(deriveUpdateProgress(running('updater')))).toBe(
      'backup:done pull:done verify:done swap:done health:done updater:running',
    );
  });

  it('marks the health check failed while the previous version is started again', () => {
    const progress = deriveUpdateProgress(running('restore'));
    expect(progress).toMatchObject({ outcome: 'running', rollingBack: true });
    expect(statuses(progress)).toBe(
      'backup:done pull:done verify:done swap:done health:failed updater:skipped',
    );
  });

  it('ends succeeded, with the updater step done only when it moved', () => {
    const done = status({
      target: '1.3.0',
      startedAt: AT,
      history: [entry('succeeded')],
      selfUpdate: { outcome: 'updated', from: '1.2.0', to: '1.3.0', message: null },
    });
    expect(deriveUpdateProgress(done)?.outcome).toBe('succeeded');
    expect(deriveUpdateProgress(done)?.steps.every((step) => step.status === 'done')).toBe(true);
    const kept = { ...done, selfUpdate: { ...done.selfUpdate!, outcome: 'kept' as const } };
    expect(deriveUpdateProgress(kept)?.steps.at(-1)?.status).toBe('skipped');
  });

  it('ends failed at the step that failed', () => {
    const failed = status({
      state: 'failed',
      operation: 'update',
      step: 'verify',
      target: '1.3.0',
      startedAt: AT,
      message: 'Signature verification failed',
      history: [entry('failed')],
    });
    const progress = deriveUpdateProgress(failed);
    expect(progress).toMatchObject({ outcome: 'failed', message: 'Signature verification failed' });
    expect(statuses(progress)).toBe(
      'backup:done pull:done verify:failed swap:pending health:pending updater:pending',
    );
  });

  it('ends rolled back after a failed health check', () => {
    const progress = deriveUpdateProgress(
      status({ target: '1.3.0', startedAt: AT, history: [entry('rolled_back')] }),
    );
    expect(progress?.outcome).toBe('rolled_back');
    expect(progress?.steps.find((step) => step.id === 'health')?.status).toBe('failed');
  });

  it('says nothing about rollbacks or an older update than the one asked for', () => {
    expect(
      deriveUpdateProgress(status({ state: 'running', operation: 'rollback', step: 'rollback' })),
    ).toBeNull();
    expect(
      deriveUpdateProgress(
        status({ target: '1.4.0', startedAt: AT, history: [entry('succeeded')] }),
      ),
    ).toBeNull();
  });
});
