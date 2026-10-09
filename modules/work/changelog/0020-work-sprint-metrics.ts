import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The cache tech design §14 describes for velocity, burndown and flow:
 * one row per board or sprint and metric kind, recomputed by the
 * quiet-period job after the board changes and read by the metrics strip.
 */
export default changeset({
  id: '0020-work-sprint-metrics',
  author: 'bemmoly',
  description: 'Create sprint_metrics',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE sprint_metrics (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        scope_kind text NOT NULL
          CONSTRAINT sprint_metrics_scope_kind_check CHECK (scope_kind IN ('board', 'sprint')),
        scope_id uuid NOT NULL,
        kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        computed_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX sprint_metrics_scope_kind_key
        ON sprint_metrics (scope_kind, scope_id, kind)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE sprint_metrics`);
  },
});
