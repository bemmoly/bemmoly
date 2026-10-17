import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The catalog lives with the code (architecture §9). An application read from a
 * repository's `.bemmoly/application.yaml` records that the file is its source of truth;
 * a UI edit to it becomes a pull request, or a pending change when the code host cannot
 * take one. Files that fail to read keep their error until the next push fixes them.
 * Discovery proposes applications per repository for a person to accept in bulk.
 */
export default changeset({
  id: '0011-pipelines-catalog-sync',
  author: 'bemmoly',
  description: 'Add catalog sources, pending catalog changes, file errors and discovery proposals',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_applications
        ADD COLUMN source text NOT NULL DEFAULT 'ui' CHECK (source IN ('ui', 'repository')),
        ADD COLUMN file_path text,
        ADD COLUMN source_commit_sha text,
        ADD COLUMN paths text[] NOT NULL DEFAULT '{}'`);
    await ctx.exec(sql`ALTER TABLE pipeline_repositories ADD COLUMN discovered_at timestamptz`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_catalog_changes (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        repository_id uuid REFERENCES pipeline_repositories (id) ON DELETE SET NULL,
        kind text NOT NULL CHECK (kind IN ('create', 'update', 'archive')),
        state text NOT NULL CHECK (state IN ('pull_request', 'pending', 'applied', 'discarded')),
        summary text NOT NULL,
        changes jsonb NOT NULL DEFAULT '{}'::jsonb,
        file_path text,
        file_content text,
        pull_request_url text,
        reason text,
        created_by uuid REFERENCES users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_catalog_changes_application_idx
        ON pipeline_catalog_changes (application_id, created_at DESC, id DESC)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_catalog_changes_open_idx ON pipeline_catalog_changes (created_at, id)
        WHERE state IN ('pull_request', 'pending')`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_catalog_file_errors (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        repository_id uuid NOT NULL REFERENCES pipeline_repositories (id) ON DELETE CASCADE,
        path text NOT NULL,
        commit_sha text NOT NULL,
        message text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_catalog_file_errors_key
        ON pipeline_catalog_file_errors (repository_id, path)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_discovery_proposals (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        repository_id uuid NOT NULL REFERENCES pipeline_repositories (id) ON DELETE CASCADE,
        path text NOT NULL,
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL,
        description text,
        signals text[] NOT NULL DEFAULT '{}',
        runtime text NOT NULL DEFAULT 'container-service'
          CHECK (runtime IN ('container-service', 'kubernetes', 'function', 'static-site')),
        owner_raw text,
        owner_source text CHECK (owner_source IN ('codeowners', 'backstage')),
        owner_team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
        group_path text,
        state text NOT NULL DEFAULT 'proposed' CHECK (state IN ('proposed', 'accepted', 'dismissed')),
        application_id uuid REFERENCES pipeline_applications (id) ON DELETE SET NULL,
        commit_sha text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_discovery_proposals_path_key
        ON pipeline_discovery_proposals (repository_id, path)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_discovery_proposals_state_idx
        ON pipeline_discovery_proposals (state, created_at, id)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_discovery_proposals`);
    await ctx.exec(sql`DROP TABLE pipeline_catalog_file_errors`);
    await ctx.exec(sql`DROP TABLE pipeline_catalog_changes`);
    await ctx.exec(sql`ALTER TABLE pipeline_repositories DROP COLUMN discovered_at`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_applications
        DROP COLUMN paths, DROP COLUMN source_commit_sha, DROP COLUMN file_path, DROP COLUMN source`);
  },
});
