import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Discovery finds the repositories itself: a sweep asks the connected hosts which ones
 * Pipelines may read and scans those it has not seen, so setup can show how far it got.
 * Each repository keeps when a scan was asked for and why the last one could not read it.
 */
export default changeset({
  id: '0019-pipelines-discovery-sweeps',
  author: 'bemmoly',
  description: 'Record discovery sweeps and each repository scan request and failure',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_repositories
        ADD COLUMN discovery_requested_at timestamptz,
        ADD COLUMN discovery_error text`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_discovery_sweeps (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        rescan boolean NOT NULL DEFAULT false,
        started_at timestamptz NOT NULL DEFAULT now(),
        finished_at timestamptz,
        repositories integer,
        queued integer,
        error text
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_discovery_sweeps_started_idx
        ON pipeline_discovery_sweeps (started_at DESC)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_discovery_sweeps`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_repositories
        DROP COLUMN discovery_requested_at,
        DROP COLUMN discovery_error`);
  },
});
