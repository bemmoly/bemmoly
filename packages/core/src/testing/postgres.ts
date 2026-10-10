import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { getContainerRuntimeClient } from 'testcontainers';
import postgres from 'postgres';
import { adoptDockerCliContext } from './docker-context.ts';

export const POSTGRES_TEST_IMAGE = 'pgvector/pgvector:pg18';

/** How long a fresh container may take to answer through its forwarded port. */
const ANSWER_DEADLINE_MS = 120_000;
const ATTEMPT_TIMEOUT_SECONDS = 3;

/**
 * Waits for a round trip through the container's host port. Postgres logs that it is ready
 * before a VM-backed runtime (Colima) forwards the port; a first connection made then can hang
 * until postgres.js gives up. Each attempt here is short and retried, so a test's first query
 * never races the forwarder, however loaded the machine is.
 */
async function untilAnswering(url: string): Promise<void> {
  const deadline = Date.now() + ANSWER_DEADLINE_MS;
  for (;;) {
    const probe = postgres(url, {
      max: 1,
      connect_timeout: ATTEMPT_TIMEOUT_SECONDS,
      onnotice: () => undefined,
    });
    try {
      await probe`select 1`;
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
    } finally {
      await probe.end({ timeout: 1 });
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export type TestDatabase =
  | { available: true; url: string; source: 'env' | 'testcontainers'; stop(): Promise<void> }
  | { available: false; reason: string };

/**
 * A real Postgres for integration tests. CI provides one through
 * BEMMOLY_TEST_DATABASE_URL (a service container); locally Testcontainers starts
 * pgvector/pgvector:pg18. Without either, tests skip with the reason.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const fromEnv = process.env['BEMMOLY_TEST_DATABASE_URL'];
  if (fromEnv) {
    return { available: true, url: fromEnv, source: 'env', stop: async () => undefined };
  }
  adoptDockerCliContext();
  try {
    await getContainerRuntimeClient();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      reason: `Skipped: no container runtime for Testcontainers and BEMMOLY_TEST_DATABASE_URL is not set (${detail})`,
    };
  }
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(POSTGRES_TEST_IMAGE)
    .withDatabase('bemmoly_db')
    .withUsername('bemmoly')
    .withPassword('bemmoly')
    .start();
  await untilAnswering(container.getConnectionUri());
  return {
    available: true,
    url: container.getConnectionUri(),
    source: 'testcontainers',
    stop: async () => {
      await container.stop();
    },
  };
}
