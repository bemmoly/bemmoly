import { startContainer, type ContainerInfo, type ImageInfo } from '../clients/docker.ts';
import { waitForReady } from '../clients/readiness.ts';
import { cloneSpec, taskSpec } from './container-spec.ts';
import type { UpdaterContext } from './context.ts';

export interface SwapHandle {
  name: string;
  oldId: string;
  newId: string;
}

const stopQuietly = async (ctx: UpdaterContext, id: string) => {
  await ctx.docker.raw
    .getContainer(id)
    .stop({ t: 30 })
    .catch(() => undefined);
};

/** The running app container of the Compose project, or an error that says how to start it. */
export async function findApp(
  ctx: UpdaterContext,
): Promise<{ app: ContainerInfo; image: ImageInfo | null }> {
  const app = await ctx.docker.findService(ctx.env.COMPOSE_PROJECT, ctx.env.APP_SERVICE);
  if (!app) {
    throw new Error(
      `No ${ctx.env.APP_SERVICE} container in project ${ctx.env.COMPOSE_PROJECT}; start it with: sudo bemmoly start`,
    );
  }
  return { app, image: await ctx.docker.imageInfo(app.Image) };
}

/**
 * Stops the app, keeps it as <name>-previous, and starts `image` under the original
 * name with the same env, mounts and network aliases. `beforeStart` runs between the
 * two, e.g. a restore while nothing is connected.
 */
export async function swapImage(
  ctx: UpdaterContext,
  current: { app: ContainerInfo; image: ImageInfo | null },
  image: string,
  beforeStart?: () => Promise<void>,
): Promise<SwapHandle> {
  const name = current.app.Name.replace(/^\//, '');
  const spec = cloneSpec(current.app, current.image, image);
  const leftover = ctx.docker.raw.getContainer(`${name}-previous`);
  await leftover.remove({ force: true }).catch(() => undefined);
  await stopQuietly(ctx, current.app.Id);
  await ctx.docker.raw.getContainer(current.app.Id).rename({ name: `${name}-previous` });
  try {
    await beforeStart?.();
    const created = await ctx.docker.raw.createContainer({ ...spec, name });
    await startContainer(created);
    return { name, oldId: current.app.Id, newId: created.id };
  } catch (error) {
    await ctx.docker.raw
      .getContainer(name)
      .remove({ force: true })
      .catch(() => undefined);
    await ctx.docker.raw.getContainer(current.app.Id).rename({ name });
    await ctx.docker.raw
      .getContainer(current.app.Id)
      .start()
      .catch(() => undefined);
    throw error;
  }
}

export async function waitForApp(ctx: UpdaterContext, handle: SwapHandle, port: string) {
  return waitForReady(
    `http://${ctx.env.APP_SERVICE}:${port}/readyz`,
    ctx.env.READY_TIMEOUT_MS,
    async () => {
      const info = await ctx.docker.inspect(handle.newId).catch(() => null);
      return Boolean(info?.State.Running) && !info?.State.Restarting;
    },
  );
}

/** The new container is good: drop the old one (its image stays for rollback). */
export async function commitSwap(ctx: UpdaterContext, handle: SwapHandle): Promise<void> {
  await ctx.docker.raw
    .getContainer(handle.oldId)
    .remove({ force: true })
    .catch(() => undefined);
}

/** Removes the new container and brings the old one back under its name. */
export async function revertSwap(
  ctx: UpdaterContext,
  handle: SwapHandle,
  beforeStart?: () => Promise<void>,
): Promise<void> {
  await ctx.docker.raw
    .getContainer(handle.newId)
    .remove({ force: true })
    .catch(() => undefined);
  await beforeStart?.();
  await ctx.docker.raw.getContainer(handle.oldId).rename({ name: handle.name });
  await startContainer(ctx.docker.raw.getContainer(handle.oldId));
}

/** Runs a command in a one-off container from `image` with the app's env, mounts and network. */
export async function runTask(
  ctx: UpdaterContext,
  current: { app: ContainerInfo; image: ImageInfo | null },
  image: string,
  cmd: string[],
) {
  ctx.log(`running ${cmd.join(' ')} with ${image}`);
  return ctx.docker.runTask(taskSpec(current.app, current.image, image, cmd));
}

export function appPort(app: ContainerInfo): string {
  const entry = (app.Config.Env ?? []).find((value) => value.startsWith('PORT='));
  return entry?.slice('PORT='.length) || '8080';
}
