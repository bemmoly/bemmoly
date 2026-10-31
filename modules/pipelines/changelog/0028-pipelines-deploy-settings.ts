import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Deploy settings per application and environment, and the addresses applications answer on.
 * A settings row holds only what was set in Pipelines (scaling, resources, port, health checks,
 * how secrets arrive); the file and the runtime fill in the rest at deploy time. An address
 * row is written after each deploy, so a variable naming another application's address is
 * filled in from where that application last went out in the same environment.
 */
export default changeset({
  id: '0028-pipelines-deploy-settings',
  author: 'bemmoly',
  description: 'Add deploy settings per environment and the addresses applications answer on',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE pipeline_deploy_settings (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        settings jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (application_id, environment_id)
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_deploy_settings_environment_idx
        ON pipeline_deploy_settings (environment_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_service_addresses (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        runtime text NOT NULL
          CHECK (runtime IN ('cloud-run', 'gke-autopilot', 'gke-standard', 'attached-cluster')),
        url text,
        public_url text,
        deployed_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (application_id, environment_id)
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_service_addresses_environment_idx
        ON pipeline_service_addresses (environment_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_service_addresses`);
    await ctx.exec(sql`DROP TABLE pipeline_deploy_settings`);
  },
});
