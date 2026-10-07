import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { loadKernelChangelog } from './kernel.ts';
import { createChangelogRunner } from './runner.ts';
import { freshDatabase, tableExists, type Fresh } from './test-support.ts';
import { structuralProblems } from './validate.ts';

const IDENTITY_AND_EMAIL_TABLES = [
  'users',
  'sessions',
  'roles',
  'role_capabilities',
  'module_grants',
  'audit_log',
  'rate_limit_buckets',
  'email_outbox',
  'notifications',
  'notification_preferences',
];

describe('changelog runner: every kernel stream together', () => {
  let server: TestDatabase;
  let fresh: Fresh | undefined;

  beforeAll(async () => {
    server = await startTestDatabase();
    if (server.available) fresh = await freshDatabase(server);
  });

  afterAll(async () => {
    await fresh?.close();
    if (server.available) await server.stop();
  });

  const runnerOn = async (db: Fresh) =>
    createChangelogRunner({
      sql: db.sql,
      kernel: await loadKernelChangelog(),
      appVersion: '0.1.0',
    });

  it('treats the three streams as one valid ordered changelog', async () => {
    const kernel = await loadKernelChangelog();
    expect(structuralProblems('core', kernel).filter((p) => p.problem !== 'missing_down')).toEqual(
      [],
    );
    const prefixes = new Set(kernel.map((changeset) => changeset.id.slice(0, 2)));
    expect([...prefixes]).toEqual(['00', '01', '02']);
  });

  it('applies 00xx, then 01xx, then 02xx from empty, and nothing on a second run', async (ctx) => {
    if (!fresh) return ctx.skip(server.available ? 'no database' : server.reason);
    const kernel = await loadKernelChangelog();
    const runner = await runnerOn(fresh);
    const applied = await runner.update({ contexts: ['production'] });
    const ids = applied.map((entry) => entry.id);
    expect(ids).toEqual(kernel.map((changeset) => changeset.id));
    expect(ids.indexOf('0101-identity-users')).toBeLessThan(ids.indexOf('0201-notifications'));
    for (const table of ['settings', 'modules', ...IDENTITY_AND_EMAIL_TABLES]) {
      expect(await tableExists(fresh.sql, table)).toBe(true);
    }
    expect(await runner.update({ contexts: ['production'] })).toEqual([]);
    expect((await runner.validate()).filter((p) => p.problem === 'checksum_mismatch')).toEqual([]);
  });

  it('seeds the five system roles with the mock defaults; Org admin alone manages', async (ctx) => {
    if (!fresh) return ctx.skip(server.available ? 'no database' : server.reason);
    const { sql } = fresh;
    const roles = await sql<{ key: string }[]>`select key from roles order by key`;
    expect(roles.map((role) => role.key)).toEqual([
      'contractor',
      'member',
      'org_admin',
      'project_admin',
      'viewer',
    ]);
    const cells = await sql<{ capability: string; key: string; allowed: boolean }[]>`
      select rc.capability, r.key, rc.allowed from role_capabilities rc
      join roles r on r.id = rc.role_id
      where rc.capability in ('ai.actions.run', 'workspace.settings.manage',
                              'workspace.modules.manage', 'workspace.email.manage')
      order by rc.capability, r.key`;
    const allowed = (capability: string) =>
      cells.filter((c) => c.capability === capability && c.allowed).map((c) => c.key);
    expect(allowed('ai.actions.run')).toEqual(['member', 'org_admin', 'project_admin']);
    for (const capability of [
      'workspace.settings.manage',
      'workspace.modules.manage',
      'workspace.email.manage',
    ]) {
      expect(allowed(capability)).toEqual(['org_admin']);
    }
    const [locked] = await sql<{ count: number }[]>`
      select count(distinct capability)::int as count from role_capabilities where locked_by_org`;
    expect(locked?.count).toBe(4);
  });

  it('keeps the audit log append-only', async (ctx) => {
    if (!fresh) return ctx.skip(server.available ? 'no database' : server.reason);
    const { sql } = fresh;
    await sql`insert into audit_log (actor_kind, action, target_kind) values ('system', 'x', 'y')`;
    await expect(sql`update audit_log set action = 'z'`).rejects.toThrow(/append-only/);
    await expect(sql`delete from audit_log`).rejects.toThrow(/append-only/);
  });

  it('rolls the identity and email changesets back and applies them again', async (ctx) => {
    if (!fresh) return ctx.skip(server.available ? 'no database' : server.reason);
    const runner = await runnerOn(fresh);
    await runner.rollback('core', { toId: '0003-idempotency-keys' });
    for (const table of IDENTITY_AND_EMAIL_TABLES) {
      expect(await tableExists(fresh.sql, table)).toBe(false);
    }
    expect(await tableExists(fresh.sql, 'settings')).toBe(true);
    const reapplied = await runner.update({ contexts: ['production'] });
    expect(reapplied.map((entry) => entry.id.slice(0, 2))).not.toContain('00');
    for (const table of IDENTITY_AND_EMAIL_TABLES) {
      expect(await tableExists(fresh.sql, table)).toBe(true);
    }
  });
});
