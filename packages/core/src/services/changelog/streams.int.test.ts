import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { loadChangelogFolder } from './discover.ts';
import { loadKernelChangelog } from './kernel.ts';
import { createChangelogRunner } from './runner.ts';
import { freshDatabase, tableExists } from './test-support.ts';
import { structuralProblems } from './validate.ts';

/** Every kernel stream's changesets: data kernel 00xx, identity 01xx, email 02xx. */
async function kernelWithStreams() {
  const streams = await loadChangelogFolder(new URL('./fixtures/streams/', import.meta.url));
  return [...(await loadKernelChangelog()), ...streams];
}

describe('changelog runner: every kernel stream together', () => {
  let server: TestDatabase;

  beforeAll(async () => {
    server = await startTestDatabase();
  });

  afterAll(async () => {
    if (server.available) await server.stop();
  });

  it('treats the three streams as one valid ordered changelog', async () => {
    const kernel = await kernelWithStreams();
    expect(structuralProblems('core', kernel).filter((p) => p.problem !== 'missing_down')).toEqual(
      [],
    );
  });

  it('applies 00xx, then 01xx, then 02xx from empty, and nothing on a second run', async (ctx) => {
    if (!server.available) return ctx.skip(server.reason);
    const fresh = await freshDatabase(server);
    try {
      const kernel = await kernelWithStreams();
      const runner = createChangelogRunner({ sql: fresh.sql, kernel, appVersion: '0.1.0' });
      const applied = await runner.update({ contexts: ['production'] });
      const ids = applied.map((entry) => entry.id);
      expect(ids).toEqual(kernel.map((changeset) => changeset.id));
      expect(ids.indexOf('0101-identity-users')).toBeLessThan(ids.indexOf('0201-notifications'));
      for (const table of ['settings', 'modules', 'users', 'module_grants', 'email_outbox']) {
        expect(await tableExists(fresh.sql, table)).toBe(true);
      }
      expect(await runner.update({ contexts: ['production'] })).toEqual([]);
      expect((await runner.validate()).filter((p) => p.problem === 'checksum_mismatch')).toEqual(
        [],
      );
    } finally {
      await fresh.close();
    }
  });
});
