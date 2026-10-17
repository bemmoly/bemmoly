import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The catalog: Domain › Group › Application, the repositories they live in, the
 * dependencies between applications, cached template versions and saved views.
 * Teams come from the kernel; an application's owning team is a kernel team.
 */
export default changeset({
  id: '0001-pipelines-catalog',
  author: 'bemmoly',
  description: 'Create the Pipelines catalog: domains, groups, applications, repositories',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_domains (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        description text,
        color text NOT NULL DEFAULT 'epic-1'
          CHECK (color ~ '^epic-[1-8]$'),
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`CREATE UNIQUE INDEX pipeline_domains_key_key ON pipeline_domains (key)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_groups (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        domain_id uuid NOT NULL REFERENCES pipeline_domains (id) ON DELETE RESTRICT,
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        description text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_groups_domain_key_key ON pipeline_groups (domain_id, key)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_repositories (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        provider text NOT NULL DEFAULT 'github'
          CHECK (provider IN ('github', 'gitlab', 'bitbucket', 'other')),
        external_id text,
        full_name text NOT NULL,
        default_branch text NOT NULL DEFAULT 'main',
        url text,
        monorepo boolean NOT NULL DEFAULT false,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_repositories_full_name_key
        ON pipeline_repositories (provider, lower(full_name))`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_applications (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        key text NOT NULL CHECK (key ~ '^[a-z0-9][a-z0-9-]{0,62}$'),
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
        description text,
        domain_id uuid NOT NULL REFERENCES pipeline_domains (id) ON DELETE RESTRICT,
        group_id uuid NOT NULL REFERENCES pipeline_groups (id) ON DELETE RESTRICT,
        owner_team_id uuid REFERENCES teams (id) ON DELETE SET NULL,
        tier smallint NOT NULL DEFAULT 2 CHECK (tier BETWEEN 0 AND 2),
        labels text[] NOT NULL DEFAULT '{}',
        runtime text NOT NULL DEFAULT 'container-service'
          CHECK (runtime IN ('container-service', 'kubernetes', 'function', 'static-site')),
        lifecycle text NOT NULL DEFAULT 'production'
          CHECK (lifecycle IN ('experimental', 'production', 'deprecated')),
        ci_mode text NOT NULL DEFAULT 'runners'
          CHECK (ci_mode IN ('external', 'runners', 'template')),
        promotion_mode text NOT NULL DEFAULT 'approval'
          CHECK (promotion_mode IN ('continuous', 'approval', 'train')),
        repository_id uuid REFERENCES pipeline_repositories (id) ON DELETE SET NULL,
        path text NOT NULL DEFAULT '',
        template_ref text,
        health text NOT NULL DEFAULT 'unknown'
          CHECK (health IN ('healthy', 'degraded', 'failing', 'unknown')),
        last_deployed_at timestamptz,
        archived_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_applications_key_key ON pipeline_applications (key)`);
    // The catalog's default order is name; every facet narrows it, so each facet column
    // leads an index that ends in (name, id) for keyset pages.
    await ctx.exec(sql`
      CREATE INDEX pipeline_applications_name_idx
        ON pipeline_applications (lower(name), id) WHERE archived_at IS NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_applications_domain_idx
        ON pipeline_applications (domain_id, group_id, lower(name), id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_applications_group_idx ON pipeline_applications (group_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_applications_owner_idx
        ON pipeline_applications (owner_team_id, lower(name), id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_applications_repository_idx
        ON pipeline_applications (repository_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_applications_labels_idx
        ON pipeline_applications USING gin (labels)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_applications_search_idx ON pipeline_applications
        USING gin ((lower(key || ' ' || name)) gin_trgm_ops)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_application_dependencies (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        application_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        depends_on_id uuid NOT NULL REFERENCES pipeline_applications (id) ON DELETE CASCADE,
        source text NOT NULL DEFAULT 'declared' CHECK (source IN ('declared', 'learned')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CHECK (application_id <> depends_on_id)
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_application_dependencies_pair_key
        ON pipeline_application_dependencies (application_id, depends_on_id)`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_application_dependencies_callers_idx
        ON pipeline_application_dependencies (depends_on_id)`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_templates (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        ref text NOT NULL,
        version integer NOT NULL CHECK (version > 0),
        repository_id uuid REFERENCES pipeline_repositories (id) ON DELETE SET NULL,
        commit_sha text,
        spec jsonb NOT NULL,
        latest boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_templates_ref_version_key ON pipeline_templates (ref, version)`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX pipeline_templates_latest_key ON pipeline_templates (ref) WHERE latest`);
    await ctx.exec(sql`
      CREATE TABLE pipeline_saved_views (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        user_id uuid REFERENCES users (id) ON DELETE CASCADE,
        name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        screen text NOT NULL DEFAULT 'catalog' CHECK (screen IN ('catalog', 'runs', 'releases')),
        query jsonb NOT NULL DEFAULT '{}'::jsonb,
        position integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_saved_views_user_idx ON pipeline_saved_views (user_id, screen, position)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE pipeline_saved_views`);
    await ctx.exec(sql`DROP TABLE pipeline_templates`);
    await ctx.exec(sql`DROP TABLE pipeline_application_dependencies`);
    await ctx.exec(sql`DROP TABLE pipeline_applications`);
    await ctx.exec(sql`DROP TABLE pipeline_repositories`);
    await ctx.exec(sql`DROP TABLE pipeline_groups`);
    await ctx.exec(sql`DROP TABLE pipeline_domains`);
  },
});
