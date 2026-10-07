import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DockerClient } from '../clients/docker.ts';
import { updaterEnvSchema } from '../config/env.ts';
import type { UpdaterContext } from './context.ts';
import { runRollback } from './rollback.ts';
import { IDLE, readState, writeState } from './state.ts';
import { runUpdate } from './update.ts';

/** A Docker with no app container: every operation fails at its first step. */
async function contextWithoutApp(): Promise<UpdaterContext> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'updater-history-'));
  return {
    env: updaterEnvSchema.parse({ UPDATER_TOKEN: 'x'.repeat(40), BEMMOLY_DIR: dir }),
    docker: { findService: async () => null } as unknown as DockerClient,
    log: () => undefined,
    now: () => new Date('2026-10-20T00:00:00Z'),
  };
}

describe('failed operations in the history', () => {
  it('records a failed update with its reason', async () => {
    const ctx = await contextWithoutApp();
    await writeState(ctx.env.BEMMOLY_DIR, { ...IDLE, current: '1.2.0' });
    await expect(runUpdate(ctx, '1.3.0')).rejects.toThrow(/No bemmoly container/);
    const state = await readState(ctx.env.BEMMOLY_DIR);
    expect(state.state).toBe('failed');
    expect(state.history[0]).toMatchObject({
      operation: 'update',
      from: '1.2.0',
      to: '1.3.0',
      at: '2026-10-20T00:00:00.000Z',
      outcome: 'failed',
      backupId: null,
      message: expect.stringMatching(/No bemmoly container/),
    });
  });

  it('records a failed rollback with its reason, after the earlier entries', async () => {
    const ctx = await contextWithoutApp();
    const earlier = {
      operation: 'update' as const,
      from: '1.2.0',
      to: '1.3.0',
      at: '2026-10-19T00:00:00.000Z',
      outcome: 'succeeded' as const,
      backupId: 'b1',
      mode: null,
      verification: 'verified' as const,
      message: null,
    };
    await writeState(ctx.env.BEMMOLY_DIR, {
      ...IDLE,
      current: '1.3.0',
      previous: '1.2.0',
      history: [earlier],
    });
    await expect(runRollback(ctx, { preferRestore: false })).rejects.toThrow(/No bemmoly/);
    const state = await readState(ctx.env.BEMMOLY_DIR);
    expect(state.history).toHaveLength(2);
    expect(state.history[0]).toMatchObject({
      operation: 'rollback',
      from: '1.3.0',
      to: '1.2.0',
      outcome: 'failed',
      message: expect.stringMatching(/No bemmoly container/),
    });
    expect(state.history[1]).toEqual(earlier);
  });
});
