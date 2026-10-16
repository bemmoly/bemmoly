import type { SqlExecutor } from '@bemmoly/core';

/*
 * Values for the secrets a job's steps name. Pipelines stores references, never values, for
 * secrets in a provider's store (architecture §17); those resolve through the provider when
 * one is connected. Plain variables set on the application resolve here, so a step can be
 * given one as a secret and have it masked in its log.
 */

export interface SecretResolver {
  resolve(
    sql: SqlExecutor,
    job: { application_id: string | null },
    names: readonly string[],
  ): Promise<Record<string, string>>;
}

export const variableSecrets: SecretResolver = {
  async resolve(sql, job, names) {
    if (!job.application_id || names.length === 0) return {};
    const rows = await sql<{ name: string; value: string }[]>`
      select name, value from pipeline_variables
      where application_id = ${job.application_id} and environment_id is null
        and value is not null and name = any(${[...names]}::text[])`;
    return Object.fromEntries(rows.map((row) => [row.name, row.value]));
  },
};
