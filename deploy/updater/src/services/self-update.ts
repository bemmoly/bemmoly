import type { UpdaterSelfUpdate, UpdaterStatus } from '@bemmoly/shared';
import { startContainer, type ContainerInfo } from '../clients/docker.ts';
import { waitForReady } from '../clients/readiness.ts';
import { cloneSpec } from './container-spec.ts';
import { enterStep, type UpdaterContext } from './context.ts';
import { obtainImage, updaterImageFor, verifyImage } from './images.ts';
import { acquireLock, readEnvValue, readState, writeEnvValue, writeState } from './state.ts';
import { commitSwap, revertSwap, swapImage } from './swap.ts';

/**
 * The updater moves itself to the release it just installed (ADR 0020). The updater that ran
 * the update pulls and verifies updater:<tag> exactly as it did the app image. A one-shot
 * run (`bemmoly upgrade`) then replaces the updater service container itself; the service
 * cannot replace its own container, so it starts a short-lived helper from the verified
 * image, which waits for the lock, swaps the service container, waits for /healthz and puts
 * the old container back if the new one does not answer.
 */

const HANDOFF_LOCK_WAIT_MS = 10 * 60_000;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The release the running updater is: the image's own version, else what .env pins. */
export async function currentUpdaterVersion(ctx: UpdaterContext): Promise<string | null> {
  return (
    ctx.env.BEMMOLY_UPDATER_VERSION ?? (await readEnvValue(ctx.env.BEMMOLY_DIR, 'UPDATER_VERSION'))
  );
}

function findUpdaterService(ctx: UpdaterContext): Promise<ContainerInfo | null> {
  return ctx.docker.findService(ctx.env.COMPOSE_PROJECT, ctx.env.UPDATER_SERVICE);
}

function servicePort(service: ContainerInfo): string {
  const entry = (service.Config.Env ?? []).find((value) => value.startsWith('UPDATER_PORT='));
  return entry?.slice('UPDATER_PORT='.length) || '8090';
}

/**
 * Swaps the updater service container to `reference` and waits for it to answer. On no
 * answer the old container runs again and .env goes back to the version it had.
 */
export async function replaceUpdater(
  ctx: UpdaterContext,
  service: ContainerInfo,
  reference: string,
  to: string,
  from: string | null,
): Promise<UpdaterSelfUpdate> {
  const image = await ctx.docker.imageInfo(service.Image);
  const handle = await swapImage(ctx, { app: service, image }, reference);
  await writeEnvValue(ctx.env.BEMMOLY_DIR, 'UPDATER_VERSION', to);
  const health = await waitForReady(
    `http://${ctx.env.UPDATER_SERVICE}:${servicePort(service)}/healthz`,
    ctx.env.UPDATER_READY_TIMEOUT_MS,
    async () => {
      const info = await ctx.docker.inspect(handle.newId).catch(() => null);
      return Boolean(info?.State.Running) && !info?.State.Restarting;
    },
    'ok',
  );
  if (!health.ready) {
    await revertSwap(ctx, handle);
    if (from) await writeEnvValue(ctx.env.BEMMOLY_DIR, 'UPDATER_VERSION', from);
    return {
      outcome: 'kept',
      from,
      to,
      message: `The updater ${to} did not start (${health.detail}), so ${from ?? 'the previous updater'} runs again`,
    };
  }
  await commitSwap(ctx, handle);
  return { outcome: 'updated', from, to, message: null };
}

/** A one-off container from the verified new image that replaces the service, then exits. */
async function startHelper(
  ctx: UpdaterContext,
  service: ContainerInfo,
  reference: string,
  to: string,
  from: string | null,
): Promise<void> {
  const name = `${service.Name.replace(/^\//, '')}-handoff`;
  await ctx.docker.raw
    .getContainer(name)
    .remove({ force: true })
    .catch(() => undefined);
  const spec = cloneSpec(service, await ctx.docker.imageInfo(service.Image), reference);
  const host = service.HostConfig;
  const created = await ctx.docker.raw.createContainer({
    name,
    Image: reference,
    Cmd: ['updater-cli', 'adopt', to, ...(from ? ['--from', from] : [])],
    Env: spec.Env ?? [],
    Labels: { 'com.bemmoly.updater.task': 'true' },
    HostConfig: {
      Binds: host.Binds ?? [],
      Mounts: host.Mounts ?? [],
      NetworkMode: host.NetworkMode ?? 'bridge',
      ReadonlyRootfs: host.ReadonlyRootfs ?? true,
      Tmpfs: host.Tmpfs ?? { '/tmp': '' },
      SecurityOpt: host.SecurityOpt ?? [],
      AutoRemove: true,
    },
  });
  await startContainer(created);
}

/** Pulls and verifies updater:<tag>, then replaces the service or hands that to a helper. */
export async function startSelfUpdate(ctx: UpdaterContext, to: string): Promise<UpdaterSelfUpdate> {
  const from = await currentUpdaterVersion(ctx);
  const kept = (message: string): UpdaterSelfUpdate => ({ outcome: 'kept', from, to, message });
  if (from === to) return { outcome: 'updated', from, to, message: `Already on ${to}` };
  if (!ctx.env.BEMMOLY_UPDATER_SELF_UPDATE)
    return kept('Self-update is turned off (BEMMOLY_UPDATER_SELF_UPDATE=false)');
  const reference = updaterImageFor(ctx, to);
  try {
    await obtainImage(ctx, reference);
    await verifyImage(ctx, reference);
  } catch (error) {
    return kept(errorText(error));
  }
  const service = await findUpdaterService(ctx);
  if (!service) {
    // Installs without the in-app updater: the CLI runs this image from now on.
    await writeEnvValue(ctx.env.BEMMOLY_DIR, 'UPDATER_VERSION', to);
    return { outcome: 'updated', from, to, message: 'No updater service runs on this install' };
  }
  if (ctx.role === 'service') {
    await startHelper(ctx, service, reference, to, from);
    return { outcome: 'handing_off', from, to, message: null };
  }
  return replaceUpdater(ctx, service, reference, to, from);
}

/** Ends the self-update: the running update, if any, is done, and the state says how. */
export function finishSelfUpdate(
  ctx: UpdaterContext,
  state: UpdaterStatus,
  result: UpdaterSelfUpdate,
): UpdaterStatus {
  const updated = result.outcome === 'updated';
  const waiting = state.state === 'running' && state.step === 'updater';
  if (updated) ctx.log(`updater is on ${result.to}`);
  else ctx.log(`updater stays on ${result.from ?? 'its version'}: ${result.message ?? ''}`);
  return {
    ...state,
    ...(waiting ? { state: 'idle', operation: null, step: 'done' } : {}),
    selfUpdate: result,
    updaterVersion: updated ? result.to : (result.from ?? state.updaterVersion),
    updaterPrevious: updated && result.from !== result.to ? result.from : state.updaterPrevious,
    updatedAt: state.updatedAt ?? ctx.now().toISOString(),
    message: updated
      ? `Updated to ${result.to}; the updater moved to ${result.to} too`
      : `Updated to ${result.to}; the updater stays on ${result.from ?? 'its version'}. ${result.message ?? ''}`.trim(),
  };
}

/** The "updater" step of an update, run by the updater that did the update. */
export async function selfUpdateStep(
  ctx: UpdaterContext,
  state: UpdaterStatus,
  to: string,
): Promise<UpdaterStatus> {
  const next = await enterStep(ctx, state, 'update', 'updater', `Moving the updater to ${to}`);
  const result = await startSelfUpdate(ctx, to).catch((error: unknown): UpdaterSelfUpdate => ({
    outcome: 'kept',
    from: ctx.env.BEMMOLY_UPDATER_VERSION ?? null,
    to,
    message: errorText(error),
  }));
  if (result.outcome !== 'handing_off') return finishSelfUpdate(ctx, next, result);
  return { ...next, selfUpdate: result, message: `Handing over to the updater ${to}` };
}

/** `updater-cli adopt <tag>`: the helper's whole job, under the same lock as every operation. */
export async function adoptUpdater(
  ctx: UpdaterContext,
  to: string,
  from: string | null,
): Promise<UpdaterStatus> {
  const release = await acquireLock(ctx.env.BEMMOLY_DIR, HANDOFF_LOCK_WAIT_MS);
  let state = await readState(ctx.env.BEMMOLY_DIR);
  try {
    const service = await findUpdaterService(ctx);
    if (!service) throw new Error(`No ${ctx.env.UPDATER_SERVICE} container to replace`);
    const reference = updaterImageFor(ctx, to);
    const result =
      service.Config.Image === reference
        ? { outcome: 'updated' as const, from, to, message: null }
        : await replaceUpdater(ctx, service, reference, to, from);
    state = finishSelfUpdate(ctx, state, result);
    return state;
  } catch (error) {
    state = finishSelfUpdate(ctx, state, { outcome: 'kept', from, to, message: errorText(error) });
    throw error;
  } finally {
    await writeState(ctx.env.BEMMOLY_DIR, state);
    await release();
  }
}

/**
 * A hand-off nobody finished (the helper never started, or died before taking the lock):
 * the state is closed so the page stops waiting. A helper that holds the lock is left alone.
 */
export async function reconcileHandoff(ctx: UpdaterContext): Promise<UpdaterStatus | null> {
  const release = await acquireLock(ctx.env.BEMMOLY_DIR).catch(() => null);
  if (!release) return null;
  try {
    const state = await readState(ctx.env.BEMMOLY_DIR);
    const pending = state.selfUpdate;
    if (pending?.outcome !== 'handing_off') return null;
    const mine = await currentUpdaterVersion(ctx);
    const result: UpdaterSelfUpdate =
      mine === pending.to
        ? { ...pending, outcome: 'updated', message: null }
        : { ...pending, outcome: 'kept', message: 'The new updater did not take over' };
    const next = finishSelfUpdate(ctx, state, result);
    await writeState(ctx.env.BEMMOLY_DIR, next);
    return next;
  } finally {
    await release();
  }
}
