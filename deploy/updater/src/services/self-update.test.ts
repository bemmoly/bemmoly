import { deriveUpdateProgress } from '@bemmoly/shared';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fakeCosign,
  fakeDocker,
  healthFetch,
  type FakeDocker,
} from './fake-docker.test-support.ts';
import { adoptUpdater, reconcileHandoff, startSelfUpdate } from './self-update.ts';
import { acquireLock, IDLE, readEnvValue, readState, writeState } from './state.ts';
import { runUpdate } from './update.ts';

let fake: FakeDocker;
beforeEach(async () => {
  fake = await fakeDocker();
  vi.stubGlobal('fetch', healthFetch(fake));
});
afterEach(() => vi.unstubAllGlobals());

const NEW_UPDATER = 'ghcr.io/bemmoly/updater:1.3.0';

describe('self-update, one-shot (bemmoly upgrade)', () => {
  it('pulls and verifies the new updater, then swaps the service container', async () => {
    const result = await startSelfUpdate(fake.ctx, '1.3.0');
    expect(result).toMatchObject({ outcome: 'updated', from: '1.2.0', to: '1.3.0' });
    expect(fake.calls).toEqual([
      `pull ${NEW_UPDATER}`,
      'remove bemmoly-updater-1-previous',
      'stop upd1',
      'rename upd1 bemmoly-updater-1-previous',
      `create bemmoly-updater-1 ${NEW_UPDATER}`,
      'start c1',
      'remove upd1',
    ]);
    expect(await readEnvValue(fake.dir, 'UPDATER_VERSION')).toBe('1.3.0');
  });

  it('puts the old updater back when the new one does not answer', async () => {
    fake.healthy.set(NEW_UPDATER, false);
    const result = await startSelfUpdate(fake.ctx, '1.3.0');
    expect(result.outcome).toBe('kept');
    expect(result.message).toMatch(/did not start.*1\.2\.0 runs again/);
    expect(fake.calls.slice(-3)).toEqual([
      'remove c1',
      'rename upd1 bemmoly-updater-1',
      'start upd1',
    ]);
    expect(await readEnvValue(fake.dir, 'UPDATER_VERSION')).toBe('1.2.0');
  });

  it('refuses an updater image whose signature does not verify', async () => {
    fake = await fakeDocker({ COSIGN_BINARY: await fakeCosign(fake.dir, 1) });
    const result = await startSelfUpdate(fake.ctx, '1.3.0');
    expect(result).toMatchObject({ outcome: 'kept' });
    expect(result.message).toMatch(/Signature verification failed/);
    expect(fake.calls).toEqual([`pull ${NEW_UPDATER}`]);
    expect(await readEnvValue(fake.dir, 'UPDATER_VERSION')).toBe('1.2.0');
  });

  it('stays put when self-update is turned off or already done', async () => {
    const off = await fakeDocker({ BEMMOLY_UPDATER_SELF_UPDATE: 'false' });
    expect((await startSelfUpdate(off.ctx, '1.3.0')).outcome).toBe('kept');
    expect(off.calls).toEqual([]);
    expect((await startSelfUpdate(fake.ctx, '1.2.0')).outcome).toBe('updated');
    expect(fake.calls).toEqual([]);
  });
});

describe('self-update, from the updater service', () => {
  it('hands the swap to a helper from the verified image and does not stop itself', async () => {
    const result = await startSelfUpdate({ ...fake.ctx, role: 'service' }, '1.3.0');
    expect(result.outcome).toBe('handing_off');
    expect(fake.calls).toEqual([
      `pull ${NEW_UPDATER}`,
      'remove bemmoly-updater-1-handoff',
      `create bemmoly-updater-1-handoff ${NEW_UPDATER} updater-cli adopt 1.3.0 --from 1.2.0`,
      'start c1',
    ]);
  });

  it('the helper waits for the lock, swaps, and closes the update', async () => {
    const service = { ...fake.ctx, role: 'service' as const };
    await writeState(fake.dir, {
      ...IDLE,
      state: 'running',
      operation: 'update',
      step: 'updater',
      target: '1.3.0',
      selfUpdate: { outcome: 'handing_off', from: '1.2.0', to: '1.3.0', message: null },
    });
    const release = await acquireLock(fake.dir);
    const helper = { ...fake.ctx, env: { ...fake.ctx.env, BEMMOLY_UPDATER_VERSION: '1.3.0' } };
    const adopted = adoptUpdater(helper, '1.3.0', '1.2.0');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.calls).toEqual([]);
    await release();
    const state = await adopted;
    expect(state).toMatchObject({
      state: 'idle',
      step: 'done',
      updaterVersion: '1.3.0',
      updaterPrevious: '1.2.0',
      selfUpdate: { outcome: 'updated' },
    });
    expect(fake.calls).toContain(`create bemmoly-updater-1 ${NEW_UPDATER}`);
    expect(await reconcileHandoff(service)).toBeNull();
  });

  it('closes a hand-off nobody finished, so the page stops waiting', async () => {
    await writeState(fake.dir, {
      ...IDLE,
      state: 'running',
      operation: 'update',
      step: 'updater',
      selfUpdate: { outcome: 'handing_off', from: '1.2.0', to: '1.3.0', message: null },
    });
    const state = await reconcileHandoff(fake.ctx);
    expect(state).toMatchObject({ state: 'idle', selfUpdate: { outcome: 'kept' } });
  });
});

describe('the whole update', () => {
  it('runs every step in order and leaves app and updater on the release', async () => {
    const state = await runUpdate(fake.ctx, '1.3.0');
    expect(fake.steps).toEqual(['backup', 'pull', 'verify', 'tag', 'swap', 'health', 'updater']);
    expect(state).toMatchObject({ state: 'idle', current: '1.3.0', updaterVersion: '1.3.0' });
    expect(state.history[0]).toMatchObject({ outcome: 'succeeded', to: '1.3.0' });
    expect(deriveUpdateProgress(state)?.steps.every((step) => step.status === 'done')).toBe(true);
    const env = await readFile(path.join(fake.dir, '.env'), 'utf8');
    expect(env).toContain('VERSION=1.3.0\nUPDATER_VERSION=1.3.0');
  });

  it('as the service, ends running at the updater step until the helper takes over', async () => {
    const service = { ...fake.ctx, role: 'service' as const };
    const state = await runUpdate(service, '1.3.0');
    expect(state).toMatchObject({ state: 'running', step: 'updater' });
    expect(deriveUpdateProgress(await readState(fake.dir))).toMatchObject({
      outcome: 'running',
      steps: expect.arrayContaining([{ id: 'updater', status: 'running' }]),
    });
    const done = await adoptUpdater(fake.ctx, '1.3.0', '1.2.0');
    expect(deriveUpdateProgress(done)?.outcome).toBe('succeeded');
  });

  it('a failed updater self-update never fails the app update', async () => {
    fake.healthy.set(NEW_UPDATER, false);
    const state = await runUpdate(fake.ctx, '1.3.0');
    expect(state).toMatchObject({ state: 'idle', current: '1.3.0', updaterVersion: '1.2.0' });
    expect(state.message).toMatch(/the updater stays on 1\.2\.0/);
    expect(deriveUpdateProgress(state)?.steps.at(-1)).toEqual({ id: 'updater', status: 'skipped' });
  });
});
