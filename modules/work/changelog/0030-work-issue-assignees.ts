import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * An issue can have several assignees. Each row is one stint: removed_at stays null while the
 * person is on the issue, so overlapping stints are what pairing is later derived from, and
 * history is never rewritten. issues.assignee_id stays as the primary assignee for one minor
 * release, so readers and older replicas keep working.
 *
 * The trigger is the compatibility shim for that window: the create and update paths, the
 * importers, workflow post-actions and automation all write assignee_id directly, and every one
 * of them must leave the stints matching the primary. Replacing the primary closes the old
 * primary's stint only; co-assignees are left alone. It goes when assignee_id does.
 */
export default changeset({
  id: '0030-work-issue-assignees',
  author: 'bemmoly',
  description: 'Create issue_assignees, backfill it from assignee_id and keep the two in step',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE issue_assignees (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        issue_id uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        added_at timestamptz NOT NULL DEFAULT now(),
        removed_at timestamptz,
        CONSTRAINT issue_assignees_stint_check CHECK (removed_at IS NULL OR removed_at >= added_at)
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX issue_assignees_active_key ON issue_assignees (issue_id, user_id)
        WHERE removed_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX issue_assignees_user_id_idx ON issue_assignees (user_id)
        WHERE removed_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX issue_assignees_issue_added_idx ON issue_assignees (issue_id, added_at)`);
    await ctx.exec(sql`
      INSERT INTO issue_assignees (issue_id, user_id, added_at)
      SELECT id, assignee_id, created_at FROM issues WHERE assignee_id IS NOT NULL`);
    await ctx.exec(sql`
      CREATE FUNCTION work_sync_primary_assignee() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT NULL THEN
          UPDATE issue_assignees SET removed_at = now()
          WHERE issue_id = NEW.id AND user_id = OLD.assignee_id AND removed_at IS NULL;
        END IF;
        IF NEW.assignee_id IS NOT NULL THEN
          INSERT INTO issue_assignees (issue_id, user_id)
          VALUES (NEW.id, NEW.assignee_id)
          ON CONFLICT (issue_id, user_id) WHERE removed_at IS NULL DO NOTHING;
        END IF;
        RETURN NULL;
      END $$`);
    await ctx.exec(sql`
      CREATE TRIGGER issues_assignee_insert AFTER INSERT ON issues
      FOR EACH ROW WHEN (NEW.assignee_id IS NOT NULL)
      EXECUTE FUNCTION work_sync_primary_assignee()`);
    await ctx.exec(sql`
      CREATE TRIGGER issues_assignee_update AFTER UPDATE OF assignee_id ON issues
      FOR EACH ROW WHEN (OLD.assignee_id IS DISTINCT FROM NEW.assignee_id)
      EXECUTE FUNCTION work_sync_primary_assignee()`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TRIGGER IF EXISTS issues_assignee_update ON issues`);
    await ctx.exec(sql`DROP TRIGGER IF EXISTS issues_assignee_insert ON issues`);
    await ctx.exec(sql`DROP FUNCTION IF EXISTS work_sync_primary_assignee()`);
    await ctx.exec(sql`DROP TABLE IF EXISTS issue_assignees`);
  },
});
