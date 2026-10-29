import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * GKE as a runtime. Clusters, one per environment, created by Pipelines or attached as they
 * were; the runtime each application runs on per environment, chosen in Pipelines; what the
 * application file names; and the default every environment falls back to (Cloud Run). The
 * cluster's endpoint and certificate are read from GKE when needed, never stored.
 */
export default changeset({
  id: '0022-pipelines-gke-runtimes',
  author: 'bemmoly',
  description: 'Add clusters and a runtime per application and environment',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_environments
        ADD COLUMN default_runtime text NOT NULL DEFAULT 'cloud-run'
          CHECK (default_runtime IN ('cloud-run', 'gke-autopilot', 'gke-standard', 'attached-cluster'))`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_applications
        ADD COLUMN file_runtimes jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_application_runtimes (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        runtime text NOT NULL
          CHECK (runtime IN ('cloud-run', 'gke-autopilot', 'gke-standard', 'attached-cluster')),
        set_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (application_id, environment_id)
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_application_runtimes_environment_idx
        ON pipeline_application_runtimes (environment_id)`);
    await ctx.exec(sql`
      CREATE TABLE cloud_clusters (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        connection_id uuid NOT NULL REFERENCES cloud_connections (id) ON DELETE CASCADE,
        environment_id uuid NOT NULL UNIQUE
          REFERENCES pipeline_environments (id) ON DELETE CASCADE,
        origin text NOT NULL CHECK (origin IN ('created', 'attached')),
        mode text NOT NULL CHECK (mode IN ('autopilot', 'standard')),
        project_id text NOT NULL,
        location text NOT NULL,
        name text NOT NULL,
        status text NOT NULL DEFAULT 'creating'
          CHECK (status IN ('creating', 'ready', 'failed')),
        release_channel text,
        gateway jsonb,
        problems jsonb NOT NULL DEFAULT '[]'::jsonb,
        last_checked_at timestamptz,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (project_id, location, name)
      )`);
    await ctx.exec(sql`
      CREATE INDEX cloud_clusters_connection_idx ON cloud_clusters (connection_id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE cloud_clusters`);
    await ctx.exec(sql`DROP TABLE pipeline_application_runtimes`);
    await ctx.exec(sql`ALTER TABLE pipeline_applications DROP COLUMN file_runtimes`);
    await ctx.exec(sql`ALTER TABLE pipeline_environments DROP COLUMN default_runtime`);
  },
});
