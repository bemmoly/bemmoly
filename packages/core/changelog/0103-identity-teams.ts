import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

export default changeset({
  id: '0103-identity-teams',
  author: 'keerthi',
  description: 'Create teams, team_members and invitations',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE teams (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL,
        color text,
        lead_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        default_role_id uuid REFERENCES roles (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX teams_name_key ON teams (lower(name))`);
    await ctx.exec(sql`
      CREATE TABLE team_members (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        team_id uuid NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX team_members_team_user_key ON team_members (team_id, user_id)`);
    await ctx.exec(sql`CREATE INDEX team_members_user_id_idx ON team_members (user_id)`);
    await ctx.exec(sql`
      CREATE TABLE invitations (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        email text NOT NULL,
        role_id uuid NOT NULL REFERENCES roles (id) ON DELETE RESTRICT,
        team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
        token_hash text NOT NULL,
        invited_by uuid REFERENCES users (id) ON DELETE SET NULL,
        expires_at timestamptz NOT NULL,
        accepted_at timestamptz,
        accepted_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX invitations_token_hash_key ON invitations (token_hash)`);
    await ctx.exec(sql`
      CREATE INDEX invitations_pending_email_idx ON invitations (lower(email))
        WHERE accepted_at IS NULL AND revoked_at IS NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE invitations`);
    await ctx.exec(sql`DROP TABLE team_members`);
    await ctx.exec(sql`DROP TABLE teams`);
  },
});
