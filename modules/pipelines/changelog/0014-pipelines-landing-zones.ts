import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Landing zone plans (architecture §14). A plan is what a person previewed: the declared
 * accounts and resources, the tree they read and its spec hash. Apply names the plan and the
 * hash it showed, so a zone that changed since the preview cannot be applied unseen, and the
 * apply job is keyed by the hash so the same plan is never run twice at once.
 */
export default changeset({
  id: '0014-pipelines-landing-zones',
  author: 'bemmoly',
  description: 'Create landing zone plans for cloud connections',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE cloud_landing_zone_plans (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        connection_id uuid NOT NULL REFERENCES cloud_connections (id) ON DELETE CASCADE,
        layout text NOT NULL
          CHECK (layout IN ('per-environment', 'per-domain-environment', 'per-group-environment')),
        spec_hash text NOT NULL,
        desired jsonb NOT NULL,
        tree jsonb NOT NULL,
        counts jsonb NOT NULL,
        blockers text[] NOT NULL DEFAULT '{}',
        status text NOT NULL DEFAULT 'planned'
          CHECK (status IN ('planned', 'applying', 'applied', 'failed', 'superseded')),
        attempts integer NOT NULL DEFAULT 0,
        last_error text,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        applied_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX cloud_landing_zone_plans_connection_idx
        ON cloud_landing_zone_plans (connection_id, created_at DESC)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE cloud_landing_zone_plans`);
  },
});
