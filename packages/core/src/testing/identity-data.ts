import { sql as drizzleSql } from 'drizzle-orm';
import { createDatabase } from '../clients/drizzle.ts';
import type { SqlClient } from '../clients/postgres.ts';

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
