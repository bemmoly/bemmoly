import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '../../../contracts/authz.ts';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.ts';
import { applyKernelChangelog } from '../../../testing/kernel-changelog.ts';
import { requestRestore, requestVerify, startManualBackup } from './admin.ts';
import { createBackupRepository } from './repository.ts';
import { createHarness, findPgTools, type Harness } from './testing/harness.ts';

const admin: Actor = { kind: 'user', id: '0199c0de-0000-7000-8000-000000000001' };
const meta = { ip: '203.0.113.9', requestId: 'req-backups' };

interface AuditRow {
  action: string;
  actor_id: string;
  target_kind: string;
  target_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  ip: string;
  request_id: string;
}

describe('backups leave audit rows for start, verify and restore', () => {
  let database: TestDatabase;
  let harness: Harness | undefined;
  let skip: string | undefined;

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
      destinations: () => [],
    });
    await applyKernelChangelog(harness.sql);
  });

  afterAll(async () => {
    await harness?.sql.end({ timeout: 5 });
    if (database?.available) await database.stop();
  });

  const rows = (action: string) =>
    harness!.sql<AuditRow[]>`
      select action, actor_id, target_kind, target_id, before, after, ip, request_id
      from audit_log where action = ${action} order by id`;

  it('records who started, checked and restored a backup', async (ctx) => {
    if (!harness) return ctx.skip(skip ?? 'no harness');
    const { deps } = harness;
    const repository = createBackupRepository(harness.sql);

    const started = await startManualBackup(deps, admin, meta);
    const [start] = await rows('backup.started');
    expect(start).toMatchObject({
      actor_id: admin.id,
      target_kind: 'backup',
      target_id: started.id,
      ip: meta.ip,
      request_id: meta.requestId,
      after: { kind: 'manual', status: 'running' },
    });
    await expect
      .poll(async () => (await repository.get(started.id))?.status, { timeout: 30_000 })
      .toBe('succeeded');

    const verified = await requestVerify(deps, admin, started.id, 'list', meta);
    expect(verified).toMatchObject({ ok: true });
    const [check] = await rows('backup.verified');
    expect(check).toMatchObject({
      actor_id: admin.id,
      target_id: started.id,
      before: { state: 'listed' },
      after: { depth: 'list', state: 'listed' },
    });

    await requestRestore(deps, admin, started.id, meta);
    // The restore swaps the database; its row lands in the restored one afterwards.
    await expect
      .poll(async () => (await rows('backup.restored')).length, { timeout: 60_000 })
      .toBe(1);
    const [restored] = await rows('backup.restored');
    expect(restored).toMatchObject({
      actor_id: admin.id,
      target_id: started.id,
      request_id: meta.requestId,
      after: { setName: expect.any(String), rolledBackDatabase: expect.any(String) },
    });
  });
});
