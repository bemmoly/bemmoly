import { randomBytes } from 'node:crypto';
import postgres from 'postgres';

export interface IsolatedDatabase {
  url: string;
  drop(): Promise<void>;
}

/**
 * A fresh, empty database on the test server, so integration test files can
 * apply changelogs from empty without seeing each other's tables, including
 * when CI shares one server through BEMMOLY_TEST_DATABASE_URL.
 */
export async function createIsolatedDatabase(serverUrl: string): Promise<IsolatedDatabase> {
  const name = `bemmoly_test_${randomBytes(6).toString('hex')}`;
  const admin = postgres(serverUrl, { max: 1, onnotice: () => undefined });
  try {
    await admin`create database ${admin(name)}`;
  } finally {
    await admin.end({ timeout: 5 });
  }
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    async drop() {
      const cleanup = postgres(serverUrl, { max: 1, onnotice: () => undefined });
      try {
        await cleanup`drop database if exists ${cleanup(name)} with (force)`;
      } finally {
        await cleanup.end({ timeout: 5 });
      }
    },
  };
}
