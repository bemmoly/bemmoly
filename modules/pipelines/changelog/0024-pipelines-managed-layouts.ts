import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Managed mode on a real organisation. Connections and plans may use the Starter layout (a
 * platform project, one for non-production, one for production). A plan keeps the warnings a
 * person read before Apply and the billing account's headroom it saw, and a connection keeps
 * each problem its last check found, so a screen can list them. The landing zone's
 * resource kinds are no longer listed in the table: the service validates them, so a new kind
 * is new code and needs no schema change.
 */

export default changeset({
  id: '0024-pipelines-managed-layouts',
  author: 'bemmoly',
  description: 'Add the Starter layout, check problems, plan warnings and billing',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE cloud_connections
        DROP CONSTRAINT IF EXISTS cloud_connections_layout_check,
        ADD CONSTRAINT cloud_connections_layout_check CHECK (layout IN
          ('per-environment', 'per-domain-environment', 'per-group-environment', 'starter')),
        ADD COLUMN problems jsonb NOT NULL DEFAULT '[]'::jsonb`);
    await ctx.exec(sql`
      ALTER TABLE cloud_landing_zone_plans
        DROP CONSTRAINT IF EXISTS cloud_landing_zone_plans_layout_check,
        ADD CONSTRAINT cloud_landing_zone_plans_layout_check CHECK (layout IN
          ('per-environment', 'per-domain-environment', 'per-group-environment', 'starter')),
        ADD COLUMN warnings text[] NOT NULL DEFAULT '{}',
        ADD COLUMN billing jsonb`);
    await ctx.exec(sql`
      ALTER TABLE cloud_resources DROP CONSTRAINT IF EXISTS cloud_resources_kind_check`);
  },
  down: async (ctx) => {
    // The previous release has no Starter layout; its nearest is one project per environment.
    await ctx.exec(
      sql`UPDATE cloud_connections SET layout = 'per-environment' WHERE layout = 'starter'`,
    );
    await ctx.exec(sql`
      UPDATE cloud_landing_zone_plans SET layout = 'per-environment' WHERE layout = 'starter'`);
    await ctx.exec(sql`
      ALTER TABLE cloud_connections
        DROP COLUMN problems,
        DROP CONSTRAINT cloud_connections_layout_check,
        ADD CONSTRAINT cloud_connections_layout_check CHECK (layout IN
          ('per-environment', 'per-domain-environment', 'per-group-environment'))`);
    await ctx.exec(sql`
      ALTER TABLE cloud_landing_zone_plans
        DROP COLUMN warnings,
        DROP COLUMN billing,
        DROP CONSTRAINT cloud_landing_zone_plans_layout_check,
        ADD CONSTRAINT cloud_landing_zone_plans_layout_check CHECK (layout IN
          ('per-environment', 'per-domain-environment', 'per-group-environment'))`);
  },
});
