import { sql as drizzleSql, type SQL } from 'drizzle-orm';
import roles from '../../changelog/0100-identity-roles.ts';
import users from '../../changelog/0101-identity-users.ts';
import sessions from '../../changelog/0102-identity-sessions.ts';
import teams from '../../changelog/0103-identity-teams.ts';
import containers from '../../changelog/0104-identity-containers.ts';
import moduleGrants from '../../changelog/0105-identity-module-grants.ts';
import auditLog from '../../changelog/0106-audit-log.ts';
import rateLimits from '../../changelog/0107-rate-limit-buckets.ts';
import seed from '../../changelog/0108-identity-seed.ts';
import { createDatabase, type Database } from '../clients/drizzle.ts';
import type { SqlClient } from '../clients/postgres.ts';
import type { Changeset, ChangesetContext } from '../contracts/changelog.ts';

/**
 * TEMPORARY until the kernel changelog runner lands: applies the identity,
 * authz and audit changesets in order, each in its own transaction, with no
 * bookkeeping table. The runner replaces this; delete the file then.
 */
export const IDENTITY_CHANGESETS: readonly Changeset[] = [
  roles,
  users,
  sessions,
  teams,
  containers,
  moduleGrants,
  auditLog,
  rateLimits,
  seed,
];

function contextFor(db: Database): ChangesetContext {
  return {
    exec: async (statement: SQL) => {
      await db.execute(statement);
    },
    query: async <Row extends Record<string, unknown>>(statement: SQL) =>
      (await db.execute(statement)) as unknown as Row[],
    backfill: async () => {
      throw new Error('backfill is not supported by the temporary identity changeset helper');
    },
    services: {},
    log: () => undefined,
  };
}

export async function applyIdentityChangesets(sql: SqlClient): Promise<void> {
  const db = createDatabase(sql);
  for (const changeset of IDENTITY_CHANGESETS) {
    await db.transaction(async (tx) => changeset.up(contextFor(tx)));
  }
}

/** Runs every `down` in reverse order, for round-trip tests. */
export async function revertIdentityChangesets(sql: SqlClient): Promise<void> {
  const db = createDatabase(sql);
  for (const changeset of [...IDENTITY_CHANGESETS].reverse()) {
    await db.transaction(async (tx) => changeset.down?.(contextFor(tx)));
  }
}

/** Empties every identity table except the seeded roles, matrix and password provider. */
export async function resetIdentityData(sql: SqlClient): Promise<void> {
  const db = createDatabase(sql);
  await db.transaction(async (tx) => {
    await tx.execute(drizzleSql`SET LOCAL bemmoly.audit_purge = 'on'`);
    await tx.execute(drizzleSql`
      TRUNCATE users, sessions, api_tokens, invitations, teams, team_members,
        password_reset_tokens, auth_identities, module_grants, project_members, space_members,
        project_role_capabilities, space_role_capabilities, rate_limit_buckets CASCADE`);
    await tx.execute(drizzleSql`DELETE FROM audit_log`);
    await tx.execute(drizzleSql`DELETE FROM roles WHERE NOT is_system`);
  });
}
