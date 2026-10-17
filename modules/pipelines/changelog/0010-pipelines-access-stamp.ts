import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Effective permissions are cached per (person, application) in each process (architecture
 * §10.1). The cache is only safe if any change to what decides access is seen at once on
 * every replica, so one row holds a version stamp that triggers bump in the same transaction
 * as the change; a cached answer carries the stamp it was computed under and is dropped when
 * the stamp moves. Triggers rather than calls in the services, so a seed, an import or a
 * hand-run statement is covered the same way. Applications and users bump it only when a
 * column that decides access changes, never for health or last-seen writes.
 */

const STATEMENT_TABLES = [
  'pipeline_role_bindings',
  'pipeline_policies',
  'pipeline_policy_versions',
  'pipeline_freezes',
  'pipeline_domains',
  'pipeline_groups',
  'pipeline_environments',
  'teams',
  'team_members',
] as const;

const triggerOf = (table: string) => sql.identifier(`${table}_access_stamp`);

export default changeset({
  id: '0010-pipelines-access-stamp',
  author: 'bemmoly',
  description: 'Bump a Pipelines access version stamp whenever bindings, policies or owners change',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_access_stamps (
        id smallint PRIMARY KEY CHECK (id = 1),
        stamp bigint NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`INSERT INTO pipeline_access_stamps (id) VALUES (1)`);
    await ctx.exec(sql`
      CREATE FUNCTION pipeline_bump_access_stamp() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE pipeline_access_stamps SET stamp = stamp + 1, updated_at = now() WHERE id = 1;
        RETURN NULL;
      END
      $$`);
    for (const table of STATEMENT_TABLES) {
      await ctx.exec(sql`
        CREATE TRIGGER ${triggerOf(table)}
          AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON ${sql.identifier(table)}
          FOR EACH STATEMENT EXECUTE FUNCTION pipeline_bump_access_stamp()`);
    }
    await ctx.exec(sql`
      CREATE TRIGGER pipeline_applications_access_stamp AFTER UPDATE ON pipeline_applications
        FOR EACH ROW WHEN (
          OLD.owner_team_id IS DISTINCT FROM NEW.owner_team_id
          OR OLD.group_id IS DISTINCT FROM NEW.group_id
          OR OLD.domain_id IS DISTINCT FROM NEW.domain_id
          OR OLD.tier IS DISTINCT FROM NEW.tier
          OR OLD.labels IS DISTINCT FROM NEW.labels
          OR OLD.lifecycle IS DISTINCT FROM NEW.lifecycle
          OR OLD.runtime IS DISTINCT FROM NEW.runtime
          OR OLD.key IS DISTINCT FROM NEW.key
          OR OLD.archived_at IS DISTINCT FROM NEW.archived_at)
        EXECUTE FUNCTION pipeline_bump_access_stamp()`);
    await ctx.exec(sql`
      CREATE TRIGGER pipeline_applications_access_stamp_rows
        AFTER INSERT OR DELETE ON pipeline_applications
        FOR EACH STATEMENT EXECUTE FUNCTION pipeline_bump_access_stamp()`);
    await ctx.exec(sql`
      CREATE TRIGGER users_pipeline_access_stamp AFTER UPDATE ON users FOR EACH ROW
        WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.role_id IS DISTINCT FROM NEW.role_id)
        EXECUTE FUNCTION pipeline_bump_access_stamp()`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TRIGGER users_pipeline_access_stamp ON users`);
    await ctx.exec(
      sql`DROP TRIGGER pipeline_applications_access_stamp_rows ON pipeline_applications`,
    );
    await ctx.exec(sql`DROP TRIGGER pipeline_applications_access_stamp ON pipeline_applications`);
    for (const table of STATEMENT_TABLES) {
      await ctx.exec(sql`DROP TRIGGER ${triggerOf(table)} ON ${sql.identifier(table)}`);
    }
    await ctx.exec(sql`DROP FUNCTION pipeline_bump_access_stamp()`);
    await ctx.exec(sql`DROP TABLE pipeline_access_stamps`);
  },
});
