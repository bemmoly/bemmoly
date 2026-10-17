import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Platform work: fleet upgrade campaigns (architecture §7) and the nightly delivery rollups
 * Insights aggregate up the catalog tree (§18).
 */
export default changeset({
  id: '0008-pipelines-platform',
  author: 'bemmoly',
  description: 'Create campaigns, campaign targets and daily delivery rollups',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_campaigns (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        template_ref text NOT NULL,
        from_version integer,
        to_version integer NOT NULL,
        wave_size integer NOT NULL DEFAULT 50 CHECK (wave_size > 0),
        state text NOT NULL DEFAULT 'draft'
          CHECK (state IN ('draft', 'running', 'paused', 'finished', 'cancelled')),
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_campaign_targets (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        campaign_id uuid NOT NULL REFERENCES pipeline_campaigns (id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        wave integer NOT NULL DEFAULT 1,
        state text NOT NULL DEFAULT 'pending'
          CHECK (state IN ('pending', 'opened', 'merged', 'failing', 'ignored')),
        pull_request_url text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_campaign_targets_key
        ON pipeline_campaign_targets (campaign_id, application_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_campaign_targets_state_idx
        ON pipeline_campaign_targets (campaign_id, state)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_daily_rollups (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        day date NOT NULL,
        runs integer NOT NULL DEFAULT 0,
        failed_runs integer NOT NULL DEFAULT 0,
        prod_deploys integer NOT NULL DEFAULT 0,
        failed_deploys integer NOT NULL DEFAULT 0,
        rollbacks integer NOT NULL DEFAULT 0,
        lead_time_p50_seconds integer,
        restore_p50_seconds integer,
        build_minutes integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_daily_rollups_key ON pipeline_daily_rollups (application_id, day)`);
    await ctx.exec(
      sql`CREATE INDEX pipeline_daily_rollups_day_idx ON pipeline_daily_rollups (day)`,
    );
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_daily_rollups`);
    await ctx.exec(sql`DROP TABLE pipeline_campaign_targets`);
    await ctx.exec(sql`DROP TABLE pipeline_campaigns`);
  },
});
