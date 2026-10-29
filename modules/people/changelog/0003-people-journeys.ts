import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Onboarding and offboarding. A template lists tasks with an owner rule and a day offset;
 * a journey is one run of it for one person, with its tasks fanned out to real owners. One
 * open journey of a kind per person, so an event delivered twice starts it once.
 */
export default changeset({
  id: '0003-people-journeys',
  author: 'bemmoly',
  description: 'Create journey templates, journeys and their tasks',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE journey_templates (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        kind text NOT NULL CHECK (kind IN ('onboarding', 'offboarding')),
        location_id uuid REFERENCES locations (id) ON DELETE CASCADE,
        job_title text,
        tasks jsonb NOT NULL DEFAULT '[]'::jsonb,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX journey_templates_kind_idx ON journey_templates (kind)
        WHERE archived_at IS NULL`);
    await ctx.exec(sql`
      CREATE TABLE journeys (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN ('onboarding', 'offboarding')),
        template_id uuid REFERENCES journey_templates (id) ON DELETE SET NULL,
        template_name text NOT NULL,
        anchor_date date NOT NULL,
        state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'done', 'cancelled')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX journeys_open_kind_key ON journeys (user_id, kind)
        WHERE state = 'open'`);
    await ctx.exec(sql`
      CREATE TABLE journey_tasks (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        journey_id uuid NOT NULL REFERENCES journeys (id) ON DELETE CASCADE,
        title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
        owner_id uuid REFERENCES users (id) ON DELETE SET NULL,
        due_date date NOT NULL,
        position integer NOT NULL DEFAULT 0,
        done_at timestamptz,
        done_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX journey_tasks_journey_idx ON journey_tasks (journey_id, position)`);
    await ctx.exec(sql`
      CREATE INDEX journey_tasks_owner_open_idx ON journey_tasks (owner_id, due_date)
        WHERE done_at IS NULL`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE journey_tasks`);
    await ctx.exec(sql`DROP TABLE journeys`);
    await ctx.exec(sql`DROP TABLE journey_templates`);
  },
});
