import type { SqlExecutor } from '@bemmoly/core';
import type { EnvironmentClass, Tier } from '../../../../shared/common.ts';
import type { EnvironmentPath } from '../../../../shared/environments.ts';
import type { PathStepRow } from '../../models/environments.ts';

/** Every tier's path, or only `tier`'s, with its steps in stage order. */
export async function selectPaths(sql: SqlExecutor, tier?: Tier): Promise<EnvironmentPath[]> {
  const rows = await sql<PathStepRow[]>`
    select p.id as path_id, p.tier, p.name as path_name, e.id as environment_id,
      e.key as environment_key, e.name as environment_name, e.class as environment_class,
      s.stage, s.bake_minutes, s.auto_promote
    from pipeline_environment_paths p
    join pipeline_environment_path_steps s on s.path_id = p.id
    join pipeline_environments e on e.id = s.environment_id
    where (${tier ?? null}::smallint is null or p.tier = ${tier ?? null})
    order by p.tier, s.stage, e.position`;
  const paths = new Map<string, EnvironmentPath>();
  for (const row of rows) {
    let path = paths.get(row.path_id);
    if (!path) {
      path = { id: row.path_id, tier: row.tier as Tier, name: row.path_name, steps: [] };
      paths.set(row.path_id, path);
    }
    path.steps.push({
      environment: {
        id: row.environment_id,
        key: row.environment_key,
        name: row.environment_name,
        class: row.environment_class as EnvironmentClass,
      },
      stage: row.stage,
      bakeMinutes: row.bake_minutes,
      autoPromote: row.auto_promote,
    });
  }
  return [...paths.values()];
}

export async function selectPath(sql: SqlExecutor, tier: Tier): Promise<EnvironmentPath | null> {
  return (await selectPaths(sql, tier))[0] ?? null;
}
