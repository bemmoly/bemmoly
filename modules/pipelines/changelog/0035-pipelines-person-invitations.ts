import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Inviting someone to Pipelines who has no Bemmoly account yet: the role and approval groups
 * they were given wait here, by address, until they accept the workspace invitation and first
 * open Pipelines. Pending roles decide access once claimed, so the table bumps the access
 * stamp like the bindings it turns into.
 */
export default changeset({
  id: '0035-pipelines-person-invitations',
  author: 'bemmoly',
  description: 'Keep Pipelines roles for invited people until they have an account',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_person_invitations (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 320),
        role text NOT NULL CHECK (role IN ('platform_admin', 'developer', 'approver', 'viewer')),
        group_ids uuid[] NOT NULL DEFAULT '{}',
        invited_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_person_invitations_email_key
        ON pipeline_person_invitations (lower(email))`);
    await ctx.exec(sql`
      CREATE TRIGGER pipeline_person_invitations_access_stamp
        AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON pipeline_person_invitations
        FOR EACH STATEMENT EXECUTE FUNCTION pipeline_bump_access_stamp()`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_person_invitations`);
  },
});
