import { rmSync } from 'node:fs';
import { createIsolatedDatabase, startTestDatabase } from '@bemmoly/core/testing';
import { seedPeople } from './seed.ts';
import { freePort, modulesCli, startServer, writeServerEnv } from './server.ts';
import { STATE_DIR, writeState } from './state.ts';

/**
 * One real install per run: Postgres (a CI service through
 * BEMMOLY_TEST_DATABASE_URL, or a Testcontainers pgvector container), the
 * server from this checkout on a free port serving the built web app, Work
 * enabled for everyone through the operator CLI, and three people. Returns
 * the teardown, which stops all of it.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  rmSync(STATE_DIR, { recursive: true, force: true });
  const postgres = await startTestDatabase();
  if (!postgres.available) throw new Error(postgres.reason);
  const database = await createIsolatedDatabase(postgres.url);
  const port = await freePort();
  const envFile = writeServerEnv(database.url, port);
  const cleanups: (() => Promise<void>)[] = [() => postgres.stop(), () => database.drop()];
  const teardown = async () => {
    for (const cleanup of cleanups.reverse()) {
      await cleanup().catch(() => undefined);
    }
  };
  try {
    const server = await startServer(envFile, port);
    cleanups.push(() => server.stop());
    await modulesCli(envFile, ['enable', 'work', '--access', 'everyone']);
    const people = await seedPeople(server.baseURL);
    writeState({ baseURL: server.baseURL, serverLog: server.log, ...people });
  } catch (error) {
    await teardown();
    throw error;
  }
  return teardown;
}
