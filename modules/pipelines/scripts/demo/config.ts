import { loadDatabaseEnv } from '@bemmoly/core/config';

/** The seed's only configuration: the database, read by the kernel's loader. */
export function loadSeedConfig(): { databaseUrl: string } {
  return { databaseUrl: loadDatabaseEnv().DATABASE_URL };
}
