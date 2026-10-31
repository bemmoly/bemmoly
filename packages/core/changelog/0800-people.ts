import { changeset } from '@bemmoly/core/changelog';
import { sql } from 'drizzle-orm';

/*
 * The person record and its org data (ADR 0050): locations, cost centres and one people row
 * per employed user, plus the capability that writes them. Teams are the identity teams.
 * The previous minor has no code that reads any of these tables.
 */
export default changeset({
  id: '0800-people',
  author: 'shrijayan',
  description: 'Create locations, cost_centres and people; seed workspace.people.manage',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE locations (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        timezone text NOT NULL,
        country_code text CHECK (country_code ~ '^[A-Z]{2}$'),
        holiday_calendar text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX locations_name_key ON locations (lower(name))`);
    await ctx.exec(sql`
      CREATE TABLE cost_centres (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        code text NOT NULL CHECK (char_length(code) BETWEEN 1 AND 32),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        owner_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX cost_centres_code_key ON cost_centres (lower(code))`);
    await ctx.exec(sql`
      CREATE TABLE people (
        user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        state text NOT NULL DEFAULT 'offer_accepted'
          CONSTRAINT people_state_check
          CHECK (state IN ('offer_accepted', 'active', 'on_leave', 'leaving', 'left')),
        start_date date,
        end_date date,
        job_title text,
        level text,
        manager_id uuid REFERENCES people (user_id) ON DELETE SET NULL,
        team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
        location_id uuid REFERENCES locations (id) ON DELETE RESTRICT,
        cost_centre_id uuid REFERENCES cost_centres (id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT people_manager_not_self CHECK (manager_id IS NULL OR manager_id <> user_id),
        CONSTRAINT people_dates_in_order
          CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
      )`);
    await ctx.exec(sql`CREATE INDEX people_manager_idx ON people (manager_id)`);
    await ctx.exec(sql`CREATE INDEX people_team_idx ON people (team_id)`);
    await ctx.exec(sql`CREATE INDEX people_location_idx ON people (location_id)`);
    await ctx.exec(sql`CREATE INDEX people_cost_centre_idx ON people (cost_centre_id)`);
    await ctx.exec(sql`
      INSERT INTO role_capabilities (role_id, capability, allowed, locked_by_org)
      SELECT id, 'workspace.people.manage', key = 'org_admin', false FROM roles WHERE is_system
      ON CONFLICT (role_id, capability) DO NOTHING`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`
      DELETE FROM role_capabilities WHERE capability = 'workspace.people.manage'`);
    await ctx.exec(sql`DROP TABLE people`);
    await ctx.exec(sql`DROP TABLE cost_centres`);
    await ctx.exec(sql`DROP TABLE locations`);
  },
});
