import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Every server process keeps the answers to "who is this and what may they do" for a few
 * seconds (services/authz/shared-cache.ts). A write to any table those answers come from
 * sends a notification on bemmoly_authz when its transaction commits, and every process
 * listening drops its cache. Triggers rather than calls in the services, so a write from a
 * module, an import or a hand-run statement is covered the same way. Statement triggers on
 * the small tables; row triggers with a WHEN on users and api_tokens, whose last-seen and
 * last-used columns change on ordinary requests and must not empty the caches.
 */

const STATEMENT_TABLES = [
  'roles',
  'role_capabilities',
  'team_members',
  'module_grants',
  'project_members',
  'space_members',
  'project_role_capabilities',
  'space_role_capabilities',
] as const;

const triggerOf = (table: string) => sql.identifier(`${table}_authz_notify`);

export default changeset({
  id: '0114-identity-authz-notify',
  author: 'keerthi',
  description: 'Notify bemmoly_authz when roles, memberships, grants, users or tokens change',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE FUNCTION authz_notify() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_notify('bemmoly_authz', '');
        RETURN NULL;
      END
      $$`);
    for (const table of STATEMENT_TABLES) {
      await ctx.exec(sql`
        CREATE TRIGGER ${triggerOf(table)}
          AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${sql.identifier(table)}
          FOR EACH STATEMENT EXECUTE FUNCTION authz_notify()`);
    }
    await ctx.exec(sql`
      CREATE TRIGGER users_authz_notify AFTER UPDATE ON users FOR EACH ROW
        WHEN (OLD.status IS DISTINCT FROM NEW.status
          OR OLD.role_id IS DISTINCT FROM NEW.role_id
          OR OLD.privilege_version IS DISTINCT FROM NEW.privilege_version)
        EXECUTE FUNCTION authz_notify()`);
    await ctx.exec(sql`
      CREATE TRIGGER users_authz_notify_delete AFTER DELETE ON users
        FOR EACH STATEMENT EXECUTE FUNCTION authz_notify()`);
    await ctx.exec(sql`
      CREATE TRIGGER api_tokens_authz_notify AFTER UPDATE ON api_tokens FOR EACH ROW
        WHEN (OLD.revoked_at IS DISTINCT FROM NEW.revoked_at
          OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
          OR OLD.scopes IS DISTINCT FROM NEW.scopes
          OR OLD.modules IS DISTINCT FROM NEW.modules
          OR OLD.user_id IS DISTINCT FROM NEW.user_id)
        EXECUTE FUNCTION authz_notify()`);
    await ctx.exec(sql`
      CREATE TRIGGER api_tokens_authz_notify_delete AFTER DELETE ON api_tokens
        FOR EACH STATEMENT EXECUTE FUNCTION authz_notify()`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TRIGGER api_tokens_authz_notify_delete ON api_tokens`);
    await ctx.exec(sql`DROP TRIGGER api_tokens_authz_notify ON api_tokens`);
    await ctx.exec(sql`DROP TRIGGER users_authz_notify_delete ON users`);
    await ctx.exec(sql`DROP TRIGGER users_authz_notify ON users`);
    for (const table of STATEMENT_TABLES) {
      await ctx.exec(sql`DROP TRIGGER ${triggerOf(table)} ON ${sql.identifier(table)}`);
    }
    await ctx.exec(sql`DROP FUNCTION authz_notify()`);
  },
});
