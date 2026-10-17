import type { SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import type { EnvironmentClass, Tier } from '../../../../../shared/common.ts';
import type { PathStage } from '../../rollout/plan.ts';

/*
 * Where a promotion goes: an environment key, or a class ("prod" is every Prod environment
 * on the application's path, in stage order). A release moves unchanged along its path, so
 * it must already have landed in the stage before the one it is promoted to.
 */

interface PathEnvironment {
  id: string;
  key: string;
  name: string;
  class: EnvironmentClass;
  stage: number;
  bake_minutes: number;
  on_path: boolean;
}

export interface PromotionTargets {
  environments: Array<Pick<PathEnvironment, 'id' | 'key' | 'name' | 'class'>>;
  stages: PathStage[];
  environmentClass: EnvironmentClass;
}

const CLASSES = new Set<string>(['dev', 'staging', 'prod']);

export async function promotionTargets(
  sql: SqlExecutor,
  input: { tier: Tier; to: string },
): Promise<PromotionTargets & { previousStage: string[] }> {
  const rows = await sql<PathEnvironment[]>`
    select e.id, e.key, e.name, e.class, coalesce(s.stage, e.position) as stage,
      coalesce(s.bake_minutes, 0) as bake_minutes, s.id is not null as on_path
    from pipeline_environments e
    left join pipeline_environment_paths p on p.tier = ${input.tier}
    left join pipeline_environment_path_steps s on s.path_id = p.id and s.environment_id = e.id
    where e.archived_at is null
    order by coalesce(s.stage, e.position), e.position`;
  const hasPath = rows.some((row) => row.on_path);
  const usable = hasPath ? rows.filter((row) => row.on_path) : rows;
  const chosen = CLASSES.has(input.to)
    ? usable.filter((row) => row.class === input.to)
    : rows.filter((row) => row.key === input.to);
  if (chosen.length === 0) {
    throw new NotFoundError(
      CLASSES.has(input.to)
        ? `This application's path has no ${input.to} environment`
        : `There is no environment called ${input.to}`,
    );
  }
  const classes = new Set(chosen.map((row) => row.class));
  if (classes.size > 1) throw new ConflictError('A promotion goes to one class of environment');
  const byStage = new Map<number, PathStage>();
  for (const row of chosen) {
    const stage = byStage.get(row.stage) ?? {
      stage: row.stage,
      bakeMinutes: row.bake_minutes,
      environments: [],
    };
    stage.environments.push(row.key);
    byStage.set(row.stage, stage);
  }
  const first = Math.min(...chosen.map((row) => row.stage));
  const earlier = usable.filter((row) => row.stage < first);
  const previous = earlier.length ? Math.max(...earlier.map((row) => row.stage)) : null;
  return {
    environments: chosen.map(({ id, key, name, class: c }) => ({ id, key, name, class: c })),
    stages: [...byStage.values()],
    environmentClass: chosen[0]?.class ?? 'dev',
    previousStage:
      previous === null ? [] : usable.filter((row) => row.stage === previous).map((row) => row.id),
  };
}

/** Refuses a release that skipped the stage before; the first stage takes any release. */
export async function requireLandedBefore(
  sql: SqlExecutor,
  input: {
    applicationId: string;
    releaseId: string;
    previousStage: readonly string[];
    version: string;
  },
): Promise<void> {
  if (input.previousStage.length === 0) return;
  const [landed] = await sql<{ n: number }[]>`
    select count(*)::int as n from pipeline_deployments
    where application_id = ${input.applicationId} and release_id = ${input.releaseId}
      and environment_id = any(${input.previousStage as string[]}::uuid[]) and state = 'succeeded'`;
  if ((landed?.n ?? 0) === 0) {
    throw new ConflictError(
      `${input.version} has not reached the stage before this one yet. Promote it there first.`,
    );
  }
}
