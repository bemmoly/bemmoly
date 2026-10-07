import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * The trigger keeps the table append-only. A retention job may delete old rows
 * by setting `bemmoly.audit_purge = 'on'` for its own transaction only.
 */
export default changeset({
  id: '0106-audit-log',
  author: 'keerthi',
  description: 'Create the append-only audit_log with a trigger that rejects edits',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE audit_log (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        actor_id text,
        actor_kind text NOT NULL CONSTRAINT audit_log_actor_kind_check
          CHECK (actor_kind IN ('user', 'ai_plan', 'system', 'api_token')),
        actor_user_id uuid,
        action text NOT NULL,
        target_kind text NOT NULL,
        target_id text,
        before jsonb,
        after jsonb,
        ip text,
        request_id text,
        ai_plan_id uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE INDEX audit_log_action_idx ON audit_log (action, id)`);
    await ctx.exec(sql`
      CREATE INDEX audit_log_target_idx ON audit_log (target_kind, target_id, id)`);
    await ctx.exec(sql`CREATE INDEX audit_log_actor_idx ON audit_log (actor_id, id)`);
    await ctx.exec(sql`
      CREATE FUNCTION audit_log_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' AND current_setting('bemmoly.audit_purge', true) = 'on' THEN
          RETURN OLD;
        END IF;
        RAISE EXCEPTION 'audit_log is append-only' USING ERRCODE = 'insufficient_privilege';
      END
      $$`);
    await ctx.exec(sql`
      CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION audit_log_reject_change()`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE audit_log`);
    await ctx.exec(sql`DROP FUNCTION audit_log_reject_change()`);
  },
});
