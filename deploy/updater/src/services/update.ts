import type { RollbackMode, RollbackPlan, UpdaterStatus } from '@bemmoly/shared';
import { versionOf } from './container-spec.ts';
import { enterStep, parseCommandJson, type UpdaterContext } from './context.ts';
import { imageFor, obtainImage, pruneImages, verifyImage, type Verification } from './images.ts';
import {
  acquireLock,
  readState,
  setMaintenance,
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
  type SwapHandle,
} from './swap.ts';

const PRE_UPGRADE_TAG = (version: string) => `pre-upgrade-${version}`;

async function tagChangelog(ctx: UpdaterContext, appId: string, from: string): Promise<string> {
  const result = await ctx.docker.exec(appId, ['bemmoly-db', 'tag', PRE_UPGRADE_TAG(from)]);
  if (result.exitCode === 0) return `tagged ${PRE_UPGRADE_TAG(from)}`;
  if (result.exitCode === 127) return 'changelog runner not in this image; tag skipped';
  throw new Error(`bemmoly-db tag failed: ${result.stderr.trim().slice(-500)}`);
}

interface Attempt {
  from: string;
  to: string;
  backupId: string;
  backupSet: string;
  verification: Verification;
}

/**
 * The new version did not become ready: undo what it may have changed (the mode the
 * changelog dictates, computed by the previous image), then start the previous container.
 */
async function rollBackFailedUpdate(
  ctx: UpdaterContext,
  state: UpdaterStatus,
  current: Awaited<ReturnType<typeof findApp>>,
  handle: SwapHandle,
  attempt: Attempt,
  detail: string,
): Promise<UpdaterStatus> {
  let next = await enterStep(
    ctx,
    state,
    'update',
    'rollback',
    `${attempt.to} did not become ready (${detail}); going back to ${attempt.from}`,
  );
  const previousImage = current.app.Image;
  let mode: RollbackMode = 'restore';
  try {
    const plan = parseCommandJson<Partial<RollbackPlan>>(
      'bemmoly-system rollback-plan',
      await runTask(ctx, current, previousImage, ['bemmoly-system', 'rollback-plan', '--json']),
    );
    mode = plan.mode ?? 'restore';
  } catch (error) {
    ctx.log(`no rollback plan (${String(error)}); restoring the pre-upgrade backup to be safe`);
  }
  await revertSwap(ctx, handle, async () => {
    if (mode === 'schema') {
      const result = await runTask(ctx, current, imageFor(ctx, attempt.to), [
        'bemmoly-db',
        'rollback',
        '--to-tag',
        PRE_UPGRADE_TAG(attempt.from),
      ]);
      parseCommandJson('bemmoly-db rollback', { ...result, stdout: result.stdout || '{}' });
    } else if (mode === 'restore') {
      next = await enterStep(
        ctx,
        next,
        'update',
        'restore',
        `Restoring the backup taken before the update (${attempt.backupSet})`,
      );
      parseCommandJson(
        'bemmoly-system restore',
        await runTask(ctx, current, previousImage, [
          'bemmoly-system',
          'restore',
          attempt.backupSet,
          '--json',
        ]),
      );
    }
  });
  const health = await waitForApp(ctx, { ...handle, newId: handle.oldId }, appPort(current.app));
  next = withHistory(
    {
      ...next,
      state: health.ready ? 'idle' : 'failed',
      operation: null,
      step: null,
      current: attempt.from,
      previous: null,
      preUpgradeBackupId: null,
      updatedAt: ctx.now().toISOString(),
      message: health.ready
        ? `${attempt.to} did not start; ${attempt.from} is running again (${mode} rollback)`
        : `${attempt.from} did not come back either: ${health.detail}`,
    },
    {
      operation: 'update',
      from: attempt.from,
      to: attempt.to,
      at: ctx.now().toISOString(),
      outcome: 'rolled_back',
      backupId: attempt.backupId,
      mode,
      verification: attempt.verification,
      message: detail,
    },
  );
  return next;
}

/**
 * update(tag): pre-upgrade backup → pull → verify signature → tag the changelog → swap →
 * wait for /readyz (3 minutes) → keep, or roll back automatically. Maintenance mode
 * covers the swap; the previous image stays for the rollback window.
 */
export async function runUpdate(ctx: UpdaterContext, tag: string): Promise<UpdaterStatus> {
  const release = await acquireLock(ctx.env.BEMMOLY_DIR);
  let state = await readState(ctx.env.BEMMOLY_DIR);
  try {
    const reference = imageFor(ctx, tag);
    const current = await findApp(ctx);
    const from = versionOf(current.app, current.image) ?? 'unknown';
    if (from === tag) throw new Error(`Bemmoly ${tag} is already running`);

    state = await enterStep(
      ctx,
      state,
      'update',
      'backup',
      `Backing up before updating ${from} → ${tag}`,
    );
    const backup = parseCommandJson<{ id: string; locations: { location: string }[] }>(
      'bemmoly-system backup',
      await ctx.docker.exec(current.app.Id, [
        'bemmoly-system',
        'backup',
        '--kind',
        'pre_upgrade',
        '--json',
      ]),
    );
    const backupSet = backup.locations[0]?.location.split('/').filter(Boolean).pop() ?? backup.id;

    state = await enterStep(ctx, state, 'update', 'pull', `Pulling ${reference}`);
    await obtainImage(ctx, reference);
    state = await enterStep(
      ctx,
      state,
      'update',
      'verify',
      `Verifying the signature of ${reference}`,
    );
    const verification = await verifyImage(ctx, reference);
    state = await enterStep(
      ctx,
      state,
      'update',
      'tag',
      await tagChangelog(ctx, current.app.Id, from),
    );

    // Recorded before the swap: a failed start is rolled back against this.
    state = {
      ...state,
      current: tag,
      previous: from,
      updatedAt: ctx.now().toISOString(),
      preUpgradeBackupId: backup.id,
    };
    state = await enterStep(ctx, state, 'update', 'swap', `Starting ${tag}`);
    await setMaintenance(ctx.env.BEMMOLY_DIR, {
      reason: 'update',
      message: `Bemmoly is updating from ${from} to ${tag}.`,
      step: 'Starting the new version and running changesets',
      startedAt: ctx.now().toISOString(),
    });
    const handle = await swapImage(ctx, current, reference);
    state = await enterStep(ctx, state, 'update', 'health', `Waiting for ${tag} to answer /readyz`);
    const health = await waitForApp(ctx, handle, appPort(current.app));
    const attempt = { from, to: tag, backupId: backup.id, backupSet, verification };
    if (!health.ready) {
      state = await rollBackFailedUpdate(ctx, state, current, handle, attempt, health.detail);
      return state;
    }
    await commitSwap(ctx, handle);
    await writeVersion(ctx.env.BEMMOLY_DIR, tag);
    state = withHistory(
      { ...state, state: 'idle', operation: null, step: 'done', message: `Updated to ${tag}` },
      {
        operation: 'update',
        from,
        to: tag,
        at: ctx.now().toISOString(),
        outcome: 'succeeded',
        backupId: backup.id,
        mode: null,
        verification,
        message: null,
      },
    );
    await pruneImages(ctx, state).catch((error: unknown) =>
      ctx.log(`image retention failed: ${String(error)}`),
    );
    return state;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state = { ...state, state: 'failed', operation: 'update', message };
    ctx.log(`update to ${tag} failed: ${message}`);
    throw error;
  } finally {
    await setMaintenance(ctx.env.BEMMOLY_DIR, null);
    await writeState(ctx.env.BEMMOLY_DIR, state);
    await release();
  }
}
