import type { SqlExecutor } from '@bemmoly/core';
import type { RunGraphGroup } from '../../../../shared/runs.ts';
import { stagesOf } from '../orchestrator/expand.ts';

/*
 * A run's graph grouped by environment, as the editor draws the pipeline: build and checks
 * first, then each environment in path order. Each group's jobs are laid out in stages of
 * their own, after the group before it, so a group is a block of whole columns.
 */

export interface GroupableJob {
  key: string;
  needs: readonly string[];
  environment: string | null;
}

export interface GroupEnvironment {
  key: string;
  name: string;
  where: string | null;
}

export interface GroupedStages {
  stageOf: Map<string, number>;
  groups: RunGraphGroup[];
}

export function groupStages(
  jobs: readonly GroupableJob[],
  environments: readonly GroupEnvironment[],
  buildName: string,
): GroupedStages {
  const known = new Map(environments.map((environment) => [environment.key, environment]));
  const unknown = [...new Set(jobs.map((job) => job.environment))]
    .filter((key): key is string => key !== null && !known.has(key))
    .sort();
  const buckets: Array<{ name: string; environment: string | null; where: string | null }> = [
    { name: buildName, environment: null, where: null },
    ...environments.map((e) => ({ name: e.name, environment: e.key, where: e.where })),
    ...unknown.map((key) => ({ name: key, environment: key, where: null })),
  ];
  const stageOf = new Map<string, number>();
  if (!jobs.some((job) => job.environment !== null)) {
    return { stageOf: stagesOf(jobs), groups: [] };
  }
  const groups: RunGraphGroup[] = [];
  let offset = 0;
  for (const bucket of buckets) {
    const own = jobs.filter((job) => job.environment === bucket.environment);
    if (own.length === 0) continue;
    const keys = new Set(own.map((job) => job.key));
    const local = stagesOf(
      own.map((job) => ({ key: job.key, needs: job.needs.filter((need) => keys.has(need)) })),
    );
    let deepest = 0;
    for (const job of own) {
      const stage = local.get(job.key) ?? 0;
      deepest = Math.max(deepest, stage);
      stageOf.set(job.key, offset + stage);
    }
    groups.push({
      name: bucket.name,
      environment: bucket.environment,
      where: bucket.where,
      stages: Array.from({ length: deepest + 1 }, (_, index) => offset + index),
    });
    offset += deepest + 1;
  }
  return { stageOf, groups };
}

/** Each job's environment and the environments on the path, for one run. */
export async function groupingOf(sql: SqlExecutor, runId: string) {
  const jobs = await sql<{ id: string; environment_key: string | null }[]>`
    select id, environment_key from pipeline_jobs where run_id = ${runId}`;
  const environments = await sql<GroupEnvironment[]>`
    select e.key, e.name, c.external_id as where
    from pipeline_environments e left join cloud_accounts c on c.id = e.cloud_account_id
    where e.archived_at is null order by e.position, e.id`;
  return {
    environmentOf: new Map(jobs.map((job) => [job.id, job.environment_key])),
    environments,
  };
}
