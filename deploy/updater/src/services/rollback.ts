import type { RollbackMode, RollbackPlan, UpdaterStatus } from '@bemmoly/shared';
import { versionOf } from './container-spec.ts';
import { enterStep, parseCommandJson, type UpdaterContext } from './context.ts';
import { imageFor, obtainImage } from './images.ts';
import {
  acquireLock,
  readState,
  setMaintenance,
  withFailure,
  withHistory,
  writeState,
  writeVersion,
} from './state.ts';
import {
  appPort,
  commitSwap,
  findApp,
  revertSwap,
  runTask,
  swapImage,
  waitForApp,
} from './swap.ts';

export interface RollbackRequest {
  /** The mode the admin confirmed; the rollback stops if the plan changed since. */
  expectedMode?: RollbackMode;
  preferRestore: boolean;
}

/**
 * rollback(): asks the running version for the plan (code, schema or restore), then
 * reverses schema changes with the running code's `down`s, or restores the pre-upgrade
 * backup while nothing is connected, and starts the previous image.
 */
export async function runRollback(
  ctx: UpdaterContext,
  request: RollbackRequest,
): Promise<UpdaterStatus> {
  const release = await acquireLock(ctx.env.BEMMOLY_DIR);
  let state = await readState(ctx.env.BEMMOLY_DIR);
  let from = state.current ?? 'unknown';
  // What a failure entry in the history can say about the attempt.
  const planned: { mode: RollbackMode | null; backupId: string | null } = {
    mode: null,
    backupId: null,
  };
  try {
    if (!state.previous) throw new Error('There is no previous version to roll back to');
    const current = await findApp(ctx);
    from = versionOf(current.app, current.image) ?? from;
    const to = state.previous;
    const planArgs = [
      'bemmoly-system',
      'rollback-plan',
      '--json',
      ...(request.preferRestore ? ['--prefer-restore'] : []),
    ];
    const plan = parseCommandJson<Partial<RollbackPlan>>(
      'bemmoly-system rollback-plan',
      await ctx.docker.exec(current.app.Id, planArgs),
    );
    if (!plan.mode) throw new Error(plan.summary ?? 'Nothing to roll back');
    if (request.expectedMode && plan.mode !== request.expectedMode) {
      throw new Error(
        `The rollback mode is now ${plan.mode}, not ${request.expectedMode}; review the plan again`,
      );
    }
    const mode = plan.mode;
    planned.mode = mode;
    planned.backupId = plan.backupId ?? null;
    const reference = imageFor(ctx, to);
    if (!(await ctx.docker.imageInfo(reference))) await obtainImage(ctx, reference);

    state = await enterStep(
      ctx,
      state,
      'rollback',
      'rollback',
      plan.summary ?? `Rolling back to ${to}`,
    );
    await setMaintenance(ctx.env.BEMMOLY_DIR, {
      reason: 'rollback',
      message: plan.summary ?? `Rolling back to ${to}.`,
      step: `${mode} rollback`,
      startedAt: ctx.now().toISOString(),
    });
    if (mode === 'schema') {
      const result = await ctx.docker.exec(current.app.Id, [
        'bemmoly-db',
        'rollback',
        '--to-tag',
        to,
      ]);
      parseCommandJson('bemmoly-db rollback', { ...result, stdout: result.stdout || '{}' });
    }
    const handle = await swapImage(ctx, current, reference, async () => {
      if (mode !== 'restore') return;
      if (!plan.backupId)
        throw new Error('A restore rollback needs the pre-upgrade backup, and none is left');
      state = await enterStep(
        ctx,
        state,
        'rollback',
        'restore',
        `Restoring the backup taken before ${from}`,
      );
      parseCommandJson(
        'bemmoly-system restore',
        await runTask(ctx, current, reference, [
          'bemmoly-system',
          'restore',
          plan.backupId,
          '--json',
          '--as-updater',
        ]),
      );
    });
    state = await enterStep(
      ctx,
      state,
      'rollback',
      'health',
      `Waiting for ${to} to answer /readyz`,
    );
    const health = await waitForApp(ctx, handle, appPort(current.app));
    if (!health.ready) {
      await revertSwap(ctx, handle);
      throw new Error(`${to} did not become ready (${health.detail}); ${from} was started again`);
    }
    await commitSwap(ctx, handle);
    await writeVersion(ctx.env.BEMMOLY_DIR, to);
    state = withHistory(
      {
        ...state,
        state: 'idle',
        operation: null,
        step: 'done',
        current: to,
        previous: null,
        preUpgradeBackupId: null,
        updatedAt: ctx.now().toISOString(),
        message: `Rolled back to ${to} (${mode})`,
      },
      {
        operation: 'rollback',
        from,
        to,
        at: ctx.now().toISOString(),
        outcome: 'succeeded',
        backupId: plan.backupId ?? null,
        mode,
        verification: null,
        message: plan.summary ?? null,
      },
    );
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state = withFailure(state, {
      operation: 'rollback',
      from,
      to: state.previous ?? 'unknown',
      at: ctx.now().toISOString(),
      ...planned,
      message,
    });
    ctx.log(`rollback failed: ${message}`);
    throw error;
  } finally {
    await setMaintenance(ctx.env.BEMMOLY_DIR, null);
    await writeState(ctx.env.BEMMOLY_DIR, state);
    await release();
  }
}
