import type { SqlExecutor } from '@bemmoly/core';
import { ForbiddenError } from '@bemmoly/shared';

/*
 * Values for the secrets a job's steps name. Pipelines stores references, never values, for
 * secrets in a provider's store (architecture §17); those resolve through the provider when
 * one is connected. Plain variables set on the application resolve here, so a step can be
 * given one as a secret and have it masked in its log.
 */

export interface SecretResolver {
  resolve(
    sql: SqlExecutor,
    job: { application_id: string | null; run_id: string },
    names: readonly string[],
  ): Promise<Record<string, string>>;
}

export const variableSecrets: SecretResolver = {
  async resolve(sql, job, names) {
    if (!job.application_id || names.length === 0) return {};
    // A pull request from a fork runs someone else's code: it gets no secrets (§20).
    const [run] = await sql<{ from_fork: boolean }[]>`
      select from_fork from pipeline_runs where id = ${job.run_id}`;
    if (run?.from_fork !== false) return {};
    const rows = await sql<{ name: string; value: string }[]>`
      select name, value from pipeline_variables
      where application_id = ${job.application_id} and environment_id is null
        and value is not null and name = any(${[...names]}::text[])`;
    return Object.fromEntries(rows.map((row) => [row.name, row.value]));
  },
};

/** The secrets a job's steps name, and whether any of its steps has started. */
export async function secretNames(sql: SqlExecutor, jobId: string) {
  const [row] = await sql<{ names: string[] | null; started: boolean }[]>`
    select array(select distinct jsonb_array_elements_text(s->'secrets')
        from jsonb_array_elements(j.steps_spec) s) as names,
      exists(select 1 from pipeline_steps p where p.job_id = j.id and p.state <> 'pending')
        as started
    from pipeline_jobs j where j.id = ${jobId}`;
  return { names: row?.names ?? [], started: row?.started ?? false };
}

/*
 * The job token is in every step's environment (a step calls back for test splits), so a step
 * that names no secrets could otherwise read all of the job's. The runner collects them once,
 * before the first step starts; after that, and once the job has ended, they are refused.
 */
export async function secretsForRunner(
  sql: SqlExecutor,
  resolver: SecretResolver,
  job: { id: string; state: string; application_id: string | null; run_id: string },
  live: readonly string[],
): Promise<Record<string, string>> {
  const { names, started } = await secretNames(sql, job.id);
  if (!live.includes(job.state) || started) {
    throw new ForbiddenError("A job's secrets are handed out once, before its first step starts");
  }
  return resolver.resolve(sql, job, names);
}
