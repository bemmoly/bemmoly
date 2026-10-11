import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDocker, healthFetch, type FakeDocker } from '../services/fake-docker.test-support.ts';
import { readState } from '../services/state.ts';
import { createUpdaterController } from './updater.controller.ts';

let fake: FakeDocker;
beforeEach(async () => {
  fake = await fakeDocker();
  vi.stubGlobal('fetch', healthFetch(fake));
});
afterEach(() => vi.unstubAllGlobals());

describe('one update at a time', () => {
  it('answers 409 while an update runs, and after a hand-off', async () => {
    const controller = createUpdaterController({ ...fake.ctx, role: 'service' });
    expect((await controller.update({ tag: '1.3.0' })).status).toBe(202);
    expect((await controller.update({ tag: '1.3.0' })).status).toBe(409);
    await vi.waitFor(async () => expect((await readState(fake.dir)).step).toBe('updater'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await controller.update({ tag: '1.3.0' })).status).toBe(409);
    expect((await controller.rollback({})).status).toBe(409);
  });

  it('reports its own version in status', async () => {
    const controller = createUpdaterController(fake.ctx);
    expect((await controller.status()).body).toMatchObject({ updaterVersion: '1.2.0' });
  });
});
