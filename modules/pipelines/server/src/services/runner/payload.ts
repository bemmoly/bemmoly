import type { SqlExecutor } from '@bemmoly/core';
import { z } from 'zod';
import { resolvedStepSchema, type ResolvedStep } from '../../../../shared/pipeline-spec.ts';
import type { ClaimedJob } from '../../../../shared/runner.ts';
import { iso } from '../../utils/time.ts';

/*
 * What a runner receives with a claimed job: the steps exactly as resolved, the commit to
 * check out, the run's variables and inputs as environment, and the names (never values) of
 * the secrets its steps need.
 */

const stepsSchema = z.array(resolvedStepSchema);

interface PayloadRow {
  id: string;
  run_id: string;
  run_number: string | number;
  key: string;
  name: string;
  kind: ClaimedJob['kind'];
  attempt: number;
  timeout_minutes: number;
  token_expires_at: Date | string;
  shard_index: number | null;
  shard_total: number | null;
  matrix: Record<string, string | number | boolean> | null;
  steps_spec: unknown;
  ref: string;
  commit_sha: string;
  variables: Record<string, string>;
  inputs: Record<string, string | number | boolean>;
  resolved_spec: unknown;
  application_key: string | null;
  full_name: string | null;
  url: string | null;
}

function checkoutOf(spec: unknown, application: string | null): boolean {
  if (typeof spec !== 'object' || spec === null) return true;
  const value = spec as {
    checkout?: unknown;
    applications?: Array<{ key: string; pipeline: { checkout?: unknown } }>;
  };
  if (Array.isArray(value.applications)) {
    return (
      value.applications.find((entry) => entry.key === application)?.pipeline.checkout !== false
    );
  }
  return value.checkout !== false;
}

function envName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
}

export async function claimedJobPayload(
  sql: SqlExecutor,
  jobId: string,
  jobToken: string,
): Promise<ClaimedJob> {
  const [row] = await sql<PayloadRow[]>`
    select j.id, j.run_id, r.number as run_number, j.key, j.name, j.kind, j.attempt,
      j.timeout_minutes, j.token_expires_at, j.shard_index, j.shard_total, j.matrix,
      j.steps_spec, r.ref, r.commit_sha, r.variables, r.inputs, r.resolved_spec,
      a.key as application_key, p.full_name, p.url
    from pipeline_jobs j
    join pipeline_runs r on r.id = j.run_id
    left join pipeline_applications a on a.id = j.application_id
    left join pipeline_repositories p on p.id = r.repository_id
    where j.id = ${jobId}`;
  if (!row) throw new Error(`Claimed job ${jobId} vanished`);
  const parsed = stepsSchema.safeParse(row.steps_spec);
  const steps: ResolvedStep[] = parsed.success ? parsed.data : [];
  const env: Record<string, string> = { ...row.variables };
  for (const [name, value] of Object.entries(row.inputs ?? {})) {
    env[`BEMMOLY_INPUT_${envName(name)}`] = String(value);
  }
  const cloneUrl = row.url ? (row.url.endsWith('.git') ? row.url : `${row.url}.git`) : '';
  return {
    jobId: row.id,
    runId: row.run_id,
    runNumber: Number(row.run_number),
    key: row.key,
    name: row.name,
    kind: row.kind,
    attempt: row.attempt,
    jobToken,
    expiresAt: iso(row.token_expires_at),
    timeoutMinutes: row.timeout_minutes,
    repository: {
      fullName: row.full_name ?? '',
      cloneUrl,
      commitSha: row.commit_sha,
      ref: row.ref,
    },
    shard:
      row.shard_index !== null && row.shard_total !== null
        ? { index: row.shard_index, total: row.shard_total }
        : null,
    matrix: row.matrix,
    checkout: Boolean(cloneUrl) && checkoutOf(row.resolved_spec, row.application_key),
    steps,
    env,
    secrets: [...new Set(steps.flatMap((step) => step.secrets))],
    cacheKeys: [],
    oidcIssuer: null,
  };
}
