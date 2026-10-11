import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Code links (tech design §17): a pull request, branch or commit that names an issue's key,
 * written from the kernel's code host deliveries. One row per issue per thing linked, so a
 * redelivery updates the row it wrote. code_transitions holds a project's optional moves:
 * the status an issue goes to when a linked pull request opens, or when it merges.
 */
export default changeset({
  id: '0024-work-code-links',
  author: 'bemmoly',
  description: 'Create code_links and code_transitions',
  contexts: ['*'],
  preconditions: [
    {
      tableExists: { table: 'integrations' },
      onFail: 'halt',
      reason: 'code links belong to a connected code host; the kernel changesets run first',
    },
  ],
  up: async (ctx) => {
    await ctx.exec(sql`
      CREATE TABLE code_links (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        issue_id uuid NOT NULL REFERENCES issues (id) ON DELETE CASCADE,
        integration_id uuid NOT NULL REFERENCES integrations (id) ON DELETE CASCADE,
        kind text NOT NULL
          CONSTRAINT code_links_kind_check CHECK (kind IN ('pull_request', 'branch', 'commit')),
        repository text NOT NULL CHECK (char_length(repository) BETWEEN 1 AND 255),
        external_id text NOT NULL CHECK (char_length(external_id) BETWEEN 1 AND 255),
        ref text NOT NULL,
        title text NOT NULL DEFAULT '',
        url text NOT NULL DEFAULT '',
        state text
          CONSTRAINT code_links_state_check CHECK (state IN ('open', 'draft', 'merged', 'closed')),
        checks text
          CONSTRAINT code_links_checks_check CHECK (checks IN ('pending', 'passing', 'failing')),
        review text
          CONSTRAINT code_links_review_check
          CHECK (review IN ('review_required', 'approved', 'changes_requested')),
        author text,
        source_updated_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX code_links_target_key
        ON code_links (issue_id, integration_id, repository, kind, external_id)`);
    await ctx.exec(sql`
      CREATE INDEX code_links_external_idx
        ON code_links (integration_id, repository, kind, external_id)`);
    await ctx.exec(sql`CREATE INDEX code_links_integration_id_idx ON code_links (integration_id)`);
    await ctx.exec(sql`
      CREATE TABLE code_transitions (
        id uuid PRIMARY KEY DEFAULT uuidv7(),
        project_id uuid NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
        trigger text NOT NULL
          CONSTRAINT code_transitions_trigger_check
          CHECK (trigger IN ('pull_request_opened', 'pull_request_merged')),
        status_id uuid NOT NULL REFERENCES workflow_statuses (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await ctx.exec(sql`
      CREATE UNIQUE INDEX code_transitions_project_trigger_key
        ON code_transitions (project_id, trigger)`);
    await ctx.exec(
      sql`CREATE INDEX code_transitions_status_id_idx ON code_transitions (status_id)`,
    );
  },
  down: async (ctx) => {
    await ctx.exec(sql`DROP TABLE code_transitions`);
    await ctx.exec(sql`DROP TABLE code_links`);
  },
});
