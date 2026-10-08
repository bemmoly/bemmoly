import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSqlClient } from '../../../clients/postgres.ts';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.ts';
import { applyKernelChangelog } from '../../../testing/kernel-changelog.ts';
import { scanAttachments } from './attachments.ts';
import { createBackupRepository } from './repository.ts';
import { mountBackup, restoreBackup, unmountBackup } from './restore.ts';
import { listSideDatabases, withAdmin, databaseNameOf } from './restore-database.ts';
import { runBackup } from './run-backup.ts';
import { createFakeObjectStore } from './testing/fake-object-store.ts';
import { createHarness, findPgTools, writeAttachment, type Harness } from './testing/harness.ts';
import { verifyBackup } from './verify.ts';

const PASSPHRASE = 'integration-test-passphrase-0123';

describe('backups against a real Postgres 18 with pg_dump and pg_restore', () => {
  let database: TestDatabase;
  let harness: Harness | undefined;
  let skip: string | undefined;
  const remote = createFakeObjectStore();

  beforeAll(async () => {
    database = await startTestDatabase();
    if (!database.available) {
      skip = database.reason;
      return;
    }
    const found = await findPgTools(process.env['BEMMOLY_TEST_PG_BIN_DIR']);
    if ('reason' in found) {
      skip = found.reason;
      return;
    }
    harness = await createHarness({
      serverUrl: database.url,
      pgTools: found.tools,
      destinations: () => [remote],
      passphrase: PASSPHRASE,
    });
    await applyKernelChangelog(harness.sql);
    await harness.sql`create table issues (id serial primary key, title text not null)`;
    await harness.sql`
      insert into users (email, name, role_id)
      select 'u' || g || '@acme.test', 'User ' || g, (select id from roles where key = 'member')
      from generate_series(1, 12) g`;
    await harness.sql`insert into issues (title) select 'Issue ' || g from generate_series(1, 40) g`;
    await writeAttachment(harness.dataDir, 'aa11', 'first attachment');
    await writeAttachment(harness.dataDir, 'bb22', 'second attachment');
  });

  afterAll(async () => {
    await harness?.sql.end({ timeout: 5 });
    if (database?.available) await database.stop();
  });

  // Skipped on GitHub-hosted runners until the stream close under pg_dump is understood; the
  // same path is exercised end to end by the VM smoke test. Tracked in https://github.com/bemmoly/bemmoly/issues/15
  it.skipIf(process.env.CI === 'true')(
    'backs up, verifies, restores from the encrypted off-box copy and mounts read-only',
    async (ctx) => {
      if (!harness) return ctx.skip(skip ?? 'no harness');
      const { deps, sql, dataDir } = harness;
      const repository = createBackupRepository(sql);

      const first = await runBackup(deps, { kind: 'manual' });
      expect(first.status).toBe('succeeded');
      expect(first.attachmentMode).toBe('full');
      expect(first.manifest?.database.rowCounts).toMatchObject({ users: 12, issues: 40 });
      expect(first.locations.map((location) => location.destination)).toEqual(['local', 's3']);
      // Local copy is plain, the off-box copy is encrypted.
      expect(await harness.local.exists(first.setName, 'database.dump')).toBe(true);
      expect(remote.objects.has(`${first.setName}/database.dump.enc`)).toBe(true);
      expect(
        remote.objects.get(`${first.setName}/database.dump.enc`)?.subarray(0, 4).toString(),
      ).toBe('BMBK');

      await sql`insert into issues (title) values ('Issue 41'), ('Issue 42')`;
      await writeAttachment(dataDir, 'cc33', 'third attachment');
      const second = await runBackup(deps, { kind: 'manual' });
      expect(second.attachmentMode).toBe('incremental');
      expect(second.baseBackupId).toBe(first.id);
      expect(second.manifest?.attachments.fileCount).toBe(1);
      expect(second.manifest?.attachments.chain).toEqual([first.setName, second.setName]);

      const listed = await verifyBackup(deps, second.id, 'list');
      expect(listed).toMatchObject({ ok: true, depth: 'list' });
      const drill = await verifyBackup(deps, second.id, 'restore');
      expect(drill).toMatchObject({ ok: true, depth: 'restore' });
      expect((await repository.get(second.id))?.verificationState).toBe('restored');

      // Lose data, then restore the second backup from the encrypted remote copy only.
      await sql`delete from issues where id > 10`;
      await rm(path.join(dataDir, 'attachments'), { recursive: true, force: true });
      const remoteOnly = { ...deps, destinations: async () => [remote] };
      const restored = await restoreBackup(remoteOnly, second.setName);
      expect(restored.rowCounts).toMatchObject({ users: 12, issues: 42 });
      expect(restored.attachmentsRestored).toBe(3);
      expect([...(await scanAttachments(path.join(dataDir, 'attachments'))).keys()].sort()).toEqual(
        ['aa/aa11', 'bb/bb22', 'cc/cc33'],
      );
      const [count] = await sql<{ n: number }[]>`select count(*)::int as n from issues`;
      expect(count?.n).toBe(42);
      // The restored snapshot saw this backup as running; the re-index completes it.
      expect((await repository.findBySetName(second.setName))?.status).toBe('succeeded');
      expect(
        (await repository.list({ limit: 10 })).filter((row) => row.status === 'running'),
      ).toEqual([]);
      const live = databaseNameOf(harness.databaseUrl);
      const sides = await withAdmin(harness.databaseUrl, (admin) => listSideDatabases(admin, live));
      expect(sides.map((side) => side.purpose)).toContain('rolledback');
      expect(await readdir(path.join(harness.backupDir, '.staging'))).toEqual([]);

      const mounted = await mountBackup(deps, first.setName);
      const mountedSql = createSqlClient(
        harness.databaseUrl.replace(`/${live}`, `/${mounted.database}`),
        {
          maxConnections: 1,
        },
      );
      try {
        const [users] = await mountedSql<{ n: number }[]>`select count(*)::int as n from issues`;
        expect(users?.n).toBe(40);
        await expect(mountedSql`insert into issues (title) values ('nope')`).rejects.toThrow(
          /read-only/,
        );
      } finally {
        await mountedSql.end({ timeout: 5 });
      }
      await unmountBackup(deps, mounted.database);
    },
  );

  // Its input is the copy the previous test wrote, so it skips with that test on hosted runners.
  it.skipIf(process.env.CI === 'true')(
    'refuses a tampered or wrongly-keyed off-box copy',
    async (ctx) => {
      if (!harness) return ctx.skip(skip ?? 'no harness');
      const latest = await createBackupRepository(harness.sql).latest({ status: 'succeeded' });
      if (!latest) throw new Error('expected a backup from the previous test');
      const key = `${latest.setName}/database.dump.enc`;
      const original = remote.objects.get(key);
      if (!original) throw new Error('expected an encrypted remote dump');
      const remoteOnly = { ...harness.deps, destinations: async () => [remote] };

      const tampered = Buffer.from(original);
      tampered[tampered.length - 20] = (tampered[tampered.length - 20] ?? 0) ^ 0xff;
      remote.objects.set(key, tampered);
      await expect(restoreBackup(remoteOnly, latest.setName)).rejects.toThrow(/checksum|modified/);

      remote.objects.set(key, original);
      const wrongKey = {
        ...remoteOnly,
        config: { ...remoteOnly.config, backupPassphrase: 'a-different-passphrase-entirely' },
      };
      await expect(restoreBackup(wrongKey, latest.setName)).rejects.toThrow(/passphrase/);
    },
  );
});
