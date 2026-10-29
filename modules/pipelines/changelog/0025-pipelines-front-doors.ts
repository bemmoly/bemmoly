import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The front door. One per environment that turns it on, with the domain its hosts answer
 * under and the address reserved in each project it serves; one route per application,
 * holding the weights the cloud was last given; and runtime moves, each a planned or running
 * traffic shift from one runtime to another through the front door. A live move is unique
 * per application and environment. Prod environments that already exist keep running
 * without one until an admin turns it on.
 */
export default changeset({
  id: '0025-pipelines-front-doors',
  author: 'bemmoly',
  description: 'Add front doors, their routes and runtime moves',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_front_doors (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        environment_id uuid NOT NULL UNIQUE
          REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        enabled boolean NOT NULL DEFAULT true,
        domain text,
        status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'applying', 'ready', 'failed', 'off')),
        addresses jsonb NOT NULL DEFAULT '{}'::jsonb,
        problems jsonb NOT NULL DEFAULT '[]'::jsonb,
        applied_at timestamptz,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_front_door_routes (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        front_door_id uuid NOT NULL REFERENCES pipeline_front_doors (id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        account text NOT NULL,
        host text NOT NULL,
        backends jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (front_door_id, application_id)
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_front_door_routes_application_idx
        ON pipeline_front_door_routes (application_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_runtime_moves (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        release_id uuid REFERENCES pipeline_releases (id) ON DELETE SET NULL,
        from_runtime text NOT NULL,
        to_runtime text NOT NULL,
        follows_default boolean NOT NULL DEFAULT false,
        state text NOT NULL DEFAULT 'planned' CHECK (state IN (
          'planned', 'deploying', 'warming', 'shifting', 'holding', 'paused',
          'succeeded', 'rolled_back', 'failed', 'cancelled'
        )),
        paused_state text,
        steps jsonb NOT NULL DEFAULT '[]'::jsonb,
        step_index integer NOT NULL DEFAULT 0,
        traffic_percent smallint NOT NULL DEFAULT 0,
        hold_minutes integer NOT NULL DEFAULT 10,
        sample_seconds integer NOT NULL DEFAULT 60,
        from_revision text,
        to_revision text,
        failing_samples integer NOT NULL DEFAULT 0,
        waited_samples integer NOT NULL DEFAULT 0,
        message text,
        step_started_at timestamptz,
        next_action_at timestamptz,
        busy_until timestamptz,
        requested_by uuid REFERENCES users (id) ON DELETE SET NULL,
        started_by uuid REFERENCES users (id) ON DELETE SET NULL,
        finished_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_runtime_moves_open_idx
        ON pipeline_runtime_moves (application_id, environment_id)
        WHERE state IN ('planned', 'deploying', 'warming', 'shifting', 'holding', 'paused')`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_runtime_moves_due_idx ON pipeline_runtime_moves (next_action_at)
        WHERE state IN ('deploying', 'warming', 'shifting', 'holding')`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_runtime_moves`);
    await ctx.exec(sql`DROP TABLE pipeline_front_door_routes`);
    await ctx.exec(sql`DROP TABLE pipeline_front_doors`);
  },
});
