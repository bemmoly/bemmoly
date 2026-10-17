import { rmSync } from 'node:fs';
import type { FullConfig } from '@playwright/test';
import { createIsolatedDatabase, startTestDatabase } from '@bemmoly/core/testing';
import { readyLaptopPool, seedAcme, startLocalRunner } from './pipelines-install.ts';
import { seedPeople } from './seed.ts';
import { freePort, modulesCli, startServer, writeServerEnv } from './server.ts';
import { STATE_DIR, writeState } from './state.ts';

/** The applications the laptop runner can build: their pipelines are real shell steps. */
export const RUNNABLE_APPS = ['checkout-api', 'payments-worker'] as const;

/**
 * The morning walkthrough's install: Postgres, the server from this checkout serving both
 * built web apps, Pipelines enabled for everyone, the people (the first admin owns For you),
 * Acme seeded at a fraction of its size, and a local runner on the laptop pool.
 */
export default async function globalSetup(config: FullConfig): Promise<() => Promise<void>> {
  rmSync(STATE_DIR, { recursive: true, force: true });
  const postgres = await startTestDatabase();
  if (!postgres.available) throw new Error(postgres.reason);
  const database = await createIsolatedDatabase(postgres.url);
  const port = Number(config.metadata['serverPort']) || (await freePort());
  const envFile = writeServerEnv(database.url, port);
  const cleanups: (() => Promise<void>)[] = [() => postgres.stop(), () => database.drop()];
  const teardown = async () => {
    for (const cleanup of cleanups.reverse()) await cleanup().catch(() => undefined);
  };
  try {
    const server = await startServer(envFile, port);
    cleanups.push(() => server.stop());
    await modulesCli(envFile, ['enable', 'pipelines', '--access', 'everyone']);
    const people = await seedPeople(server.baseURL);
    await seedAcme(envFile, Number(config.metadata['seedScale']) || 0.1);
    const pool = await readyLaptopPool(envFile, server.baseURL, RUNNABLE_APPS);
    const runner = startLocalRunner(server.baseURL, pool);
    cleanups.push(() => runner.stop());
    writeState({ baseURL: server.baseURL, serverLog: server.log, ...people });
  } catch (error) {
    await teardown();
    throw error;
  }
  return teardown;
}
