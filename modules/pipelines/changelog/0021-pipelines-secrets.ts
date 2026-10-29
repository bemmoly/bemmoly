import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * Secrets and variables. A variable is plain (its value is stored here and shown) or a secret
 * (its value lives in the cloud's secret store; this row keeps the account it lives in, its
 * name there and the version). For a secret, `version` is the store's version number.
 *
 * Before this, nothing told a plain variable from a secret, and every value was handed to job
 * steps as a secret. So every value already here becomes a secret waiting to move: the
 * variables sweep writes each one to the store and clears it. A changeset cannot call a cloud,
 * so until that sweep has run, `problem` says what it waits for. Deployments record the set
 * they ran with, so a roll back that redeploys gets the same values and versions.
 */
export default changeset({
  id: '0021-pipelines-secrets',
  author: 'bemmoly',
  description: 'Tell secrets from plain variables, and record the set each deployment used',
  contexts: ['*'],
  up: async (ctx) => {
    await ctx.exec(sql`
      ALTER TABLE pipeline_variables
        ADD COLUMN kind text NOT NULL DEFAULT 'plain' CHECK (kind IN ('plain', 'secret')),
        ADD COLUMN secret_account_id uuid REFERENCES cloud_accounts (id) ON DELETE SET NULL,
        ADD COLUMN problem text,
        ADD CONSTRAINT pipeline_variables_plain_has_no_ref
          CHECK (kind = 'secret' OR secret_ref IS NULL)`);
    await ctx.exec(sql`UPDATE pipeline_variables SET kind = 'secret'`);
    await ctx.exec(sql`
      UPDATE pipeline_variables
      SET problem = 'Waiting to move into the secret store'
      WHERE value IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_variables_unmoved_idx ON pipeline_variables (id)
        WHERE kind = 'secret' AND value IS NOT NULL`);
    await ctx.exec(sql`
      CREATE INDEX pipeline_variables_secret_account_idx
        ON pipeline_variables (secret_account_id)`);
    await ctx.exec(sql`ALTER TABLE pipeline_deployments ADD COLUMN variables jsonb`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`ALTER TABLE pipeline_deployments DROP COLUMN variables`);
    await ctx.exec(sql`DROP INDEX pipeline_variables_secret_account_idx`);
    await ctx.exec(sql`DROP INDEX pipeline_variables_unmoved_idx`);
    await ctx.exec(sql`
      ALTER TABLE pipeline_variables
        DROP CONSTRAINT pipeline_variables_plain_has_no_ref,
        DROP COLUMN problem,
        DROP COLUMN secret_account_id,
        DROP COLUMN kind`);
  },
});
