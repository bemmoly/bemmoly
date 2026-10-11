import { randomUUID } from 'node:crypto';
import { ForbiddenError } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../../clients/drizzle.ts';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import type { Actor } from '../../contracts/authz.ts';
import { silentLogger } from '../../testing/fakes.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { applyKernelChangelog } from '../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import {
  authenticateApiToken,
  digestToken,
  generateToken,
  PERSONAL_TOKEN_PREFIX,
} from '../identity/index.ts';
import { AUTHZ_CHANNEL, createRealtimeListener, type RealtimeListener } from '../realtime/index.ts';
import { createRequestAuthorization } from './authorize.ts';
import type { ModuleCatalog } from './catalog.ts';
import { AuthorizationCache } from './shared-cache.ts';

/*
 * The process cache against real triggers: a write that takes access away reaches every
 * listening process when it commits, and without a notification no answer outlives the TTL.
 */

const modules: ModuleCatalog = {
  ids: () => ['work'],
  capabilities: () => [
    {
      moduleId: 'work',
      name: 'work.issue.view',
      label: 'View issues',
      group: 'Issues',
      defaults: {
        org_admin: true,
        project_admin: true,
        member: true,
        viewer: true,
        contractor: true,
      },
    },
  ],
};

const TTL_MS = 5_000;

async function eventually(check: () => Promise<boolean>, timeoutMs = 3_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('The condition did not hold in time');
}

describe('the process authorization cache against Postgres', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase;
  let sql: SqlClient;
  let db: Database;
  let listener: RealtimeListener;
  /** Emptied by bemmoly_authz, as the server wires it. */
  let live: AuthorizationCache;
  let memberRole = '';
  let notifications = 0;
  let now = 0;
  const clockNow = () => now;

  const person = async (): Promise<string> => {
    const [row] = await sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      values (${`${randomUUID()}@example.test`}, 'Pat', ${memberRole})
      returning id`;
    return row!.id;
  };

  const join = async (projectId: string, userId: string) => {
    await sql`
      insert into project_members (project_id, user_id, role_id)
      values (${projectId}, ${userId}, ${memberRole})`;
  };

  const canView = (cache: AuthorizationCache, actor: Actor, projectId: string) =>
    createRequestAuthorization({ db, modules, shared: cache }).can(actor, 'work.issue.view', {
      kind: 'project',
      id: projectId,
      moduleId: 'work',
    });

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url, { maxConnections: 4 });
    await applyKernelChangelog(sql);
    db = createDatabase(sql);
    const [role] = await sql<{ id: string }[]>`select id from roles where key = 'member'`;
    memberRole = role!.id;
    await sql`insert into module_grants (module_id, subject_kind) values ('work', 'everyone')`;
    live = new AuthorizationCache({ ttlMs: TTL_MS, now: clockNow });
    listener = createRealtimeListener(sql, silentLogger);
    listener.onAuthorizationChange(() => {
      notifications += 1;
      live.clear();
    });
    await listener.start();
  });

  afterAll(async () => {
    if (!server.available) return;
    await listener.stop();
    await sql.end({ timeout: 5 });
    await database.drop();
    await server.stop();
  });

  it('keeps an answer for the TTL when nothing notifies, and not a moment longer', async (ctx) => {
    if (!server.available) return ctx.skip();
    // A cache no listener empties: the fallback when the LISTEN connection is down.
    const unwired = new AuthorizationCache({ ttlMs: TTL_MS, now: clockNow });
    const project = randomUUID();
    const userId = await person();
    await join(project, userId);
    const actor: Actor = { kind: 'user', id: userId };
    expect(await canView(unwired, actor, project)).toBe(true);
    await sql`delete from project_members where project_id = ${project} and user_id = ${userId}`;
    now += TTL_MS - 1;
    expect(await canView(unwired, actor, project)).toBe(true);
    now += 1;
    expect(await canView(unwired, actor, project)).toBe(false);
  });

  it('drops a removed membership as soon as the delete commits', async (ctx) => {
    if (!server.available) return ctx.skip();
    const project = randomUUID();
    const userId = await person();
    await join(project, userId);
    const actor: Actor = { kind: 'user', id: userId };
    expect(await canView(live, actor, project)).toBe(true);
    await sql`delete from project_members where project_id = ${project} and user_id = ${userId}`;
    await eventually(async () => !(await canView(live, actor, project)));
  });

  it('refuses a deactivated person as soon as the change commits', async (ctx) => {
    if (!server.available) return ctx.skip();
    const project = randomUUID();
    const userId = await person();
    await join(project, userId);
    const actor: Actor = { kind: 'user', id: userId };
    expect(await canView(live, actor, project)).toBe(true);
    await sql`update users set status = 'deactivated' where id = ${userId}`;
    await eventually(async () => {
      const authz = createRequestAuthorization({ db, modules, shared: live });
      return authz
        .authorize(actor, 'work.issue.view', { kind: 'project', id: project, moduleId: 'work' })
        .then(
          () => false,
          (error: unknown) => error instanceof ForbiddenError,
        );
    });
  });

  it('refuses a revoked API token as soon as the revoke commits', async (ctx) => {
    if (!server.available) return ctx.skip();
    const userId = await person();
    const token = generateToken(PERSONAL_TOKEN_PREFIX);
    const [row] = await sql<{ id: string }[]>`
      insert into api_tokens (user_id, name, token_hash, token_prefix, scopes)
      values (${userId}, 'CI', ${digestToken(token)}, ${token.slice(0, 12)}, ${['read']})
      returning id`;
    const at = new Date();
    expect(await authenticateApiToken(db, token, at, live)).toMatchObject({ tokenId: row!.id });
    await sql`update api_tokens set revoked_at = now() where id = ${row!.id}`;
    await eventually(async () => (await authenticateApiToken(db, token, at, live)) === null);
  });

  it('checks a cached token against its expiry on every call', async (ctx) => {
    if (!server.available) return ctx.skip();
    const userId = await person();
    const token = generateToken(PERSONAL_TOKEN_PREFIX);
    const expiresAt = new Date(Date.now() + 60_000);
    await sql`
      insert into api_tokens (user_id, name, token_hash, token_prefix, scopes, expires_at)
      values (${userId}, 'Short', ${digestToken(token)}, ${token.slice(0, 12)}, ${['read']},
        ${expiresAt.toISOString()}::timestamptz)`;
    const cache = new AuthorizationCache({ ttlMs: TTL_MS, now: clockNow });
    expect(await authenticateApiToken(db, token, new Date(), cache)).not.toBeNull();
    expect(await authenticateApiToken(db, token, expiresAt, cache)).toBeNull();
  });

  it('stays quiet when a request only touches last-seen and last-used columns', async (ctx) => {
    if (!server.available) return ctx.skip();
    const userId = await person();
    // Drain: a marker after every earlier write, then time for anything still in flight.
    const drained = notifications;
    await sql`select pg_notify(${AUTHZ_CHANNEL}, '')`;
    await eventually(async () => notifications > drained);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const before = notifications;
    await sql`update users set last_seen_at = now(), updated_at = now() where id = ${userId}`;
    await sql`select pg_notify(${AUTHZ_CHANNEL}, '')`;
    await eventually(async () => notifications > before);
    await new Promise((resolve) => setTimeout(resolve, 200));
    // Only the marker: an update had arrived first, as the two commit in that order.
    expect(notifications).toBe(before + 1);
  });
});
