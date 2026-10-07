import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { getContainerRuntimeClient } from 'testcontainers';
import { adoptDockerCliContext } from './docker-context.ts';

export const POSTGRES_TEST_IMAGE = 'pgvector/pgvector:pg18';

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
  return {
    available: true,
    url: container.getConnectionUri(),
    source: 'testcontainers',
    stop: async () => {
      await container.stop();
    },
  };
}
