import { describe, expect, it } from 'vitest';
import type { DockerClient } from '../clients/docker.ts';
import { updaterEnvSchema } from '../config/env.ts';
import type { UpdaterContext } from './context.ts';
import { revertSwap } from './swap.ts';

const dockerError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

/** A Docker whose containers record each call; `start` fails with the given error. */
function fakeDocker(startError: Error | null) {
  const calls: string[] = [];
  const raw = {
    getContainer: (id: string) => ({
      remove: async () => {
        calls.push(`remove ${id}`);
      },
      rename: async ({ name }: { name: string }) => {
        calls.push(`rename ${id} ${name}`);
      },
      start: async () => {
        calls.push(`start ${id}`);
        if (startError) throw startError;
      },
    }),
  };
  const ctx: UpdaterContext = {
    env: updaterEnvSchema.parse({ UPDATER_TOKEN: 'x'.repeat(40) }),
    docker: { raw } as unknown as DockerClient,
    log: () => undefined,
    now: () => new Date('2026-10-20T00:00:00Z'),
  };
  return { ctx, calls };
}

const handle = { name: 'bemmoly-bemmoly-1', oldId: 'old', newId: 'new' };

describe('revertSwap', () => {
  it('brings the previous container back under its name', async () => {
    const { ctx, calls } = fakeDocker(null);
    await revertSwap(ctx, handle);
    expect(calls).toEqual(['remove new', 'rename old bemmoly-bemmoly-1', 'start old']);
  });

  it('counts a container that is already running (304) as started', async () => {
    const { ctx, calls } = fakeDocker(dockerError(304, 'container already started'));
    await expect(revertSwap(ctx, handle)).resolves.toBeUndefined();
    expect(calls).toContain('start old');
  });

  it('still fails when the container cannot start', async () => {
    const { ctx } = fakeDocker(dockerError(500, 'no such image'));
    await expect(revertSwap(ctx, handle)).rejects.toThrow(/no such image/);
  });
});
