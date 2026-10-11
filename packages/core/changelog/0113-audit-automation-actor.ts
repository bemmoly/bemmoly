import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * Automation rules act as an actor of their own, so their audit rows say a rule did it and
 * name the person it acted for. Widening the check is safe for the previous minor, which
 * never writes the new kind. The way back puts the old check on as NOT VALID, so the rows a
 * rule already wrote stay and the append-only log is never edited.
 */
export default changeset({
  id: '0113-audit-automation-actor',
  author: 'keerthi',
  description: 'Allow the automation actor kind in audit_log',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE audit_log DROP CONSTRAINT audit_log_actor_kind_check,
        ADD CONSTRAINT audit_log_actor_kind_check
          CHECK (actor_kind IN ('user', 'ai_plan', 'system', 'api_token', 'automation'))`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE audit_log DROP CONSTRAINT audit_log_actor_kind_check,
        ADD CONSTRAINT audit_log_actor_kind_check
          CHECK (actor_kind IN ('user', 'ai_plan', 'system', 'api_token')) NOT VALID`);
  },
});
