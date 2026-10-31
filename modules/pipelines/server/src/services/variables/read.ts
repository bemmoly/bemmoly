import type { SqlExecutor } from '@bemmoly/core';
import type { EnvironmentClass } from '../../../../shared/common.ts';
import type { EnvironmentRef } from '../../../../shared/environments.ts';
import type { Variable } from '../../../../shared/variables.ts';
import { iso } from '../../utils/time.ts';

/* An application's variables as the Variables tab shows them: a secret never with its value. */

interface VariableRow {
  name: string;
  kind: 'plain' | 'secret';
  value: string | null;
  version: number;
  secret_ref: string | null;
  problem: string | null;
  updated_at: Date | string;
  user_id: string | null;
  user_name: string | null;
  environment_id: string | null;
  environment_key: string | null;
  environment_name: string | null;
  environment_class: string | null;
  account: string | null;
}

function present(row: VariableRow): Variable {
  const moving = row.kind === 'secret' && row.value !== null;
  return {
    name: row.name,
    kind: row.kind,
    environment:
      row.environment_id && row.environment_key && row.environment_name
        ? {
            id: row.environment_id,
            key: row.environment_key,
            name: row.environment_name,
            class: row.environment_class as EnvironmentClass,
          }
        : null,
    value: row.kind === 'plain' ? row.value : null,
    version: moving ? null : row.version,
    state: moving ? 'moving' : 'set',
    problem: row.problem,
    location: row.secret_ref ? `${row.account ?? 'a detached project'} / ${row.secret_ref}` : null,
    updatedBy: row.user_id && row.user_name ? { id: row.user_id, name: row.user_name } : null,
    updatedAt: iso(row.updated_at),
    resolved: [],
  };
}

/** Every environment's values and the shared ones; one environment's and the shared ones. */
export async function selectVariables(
  sql: SqlExecutor,
  applicationId: string,
  filter: { environment?: string; name?: string } = {},
): Promise<Variable[]> {
  const rows = await sql<VariableRow[]>`
    select v.name, v.kind, v.value, v.version, v.secret_ref, v.problem, v.updated_at,
      u.id as user_id, u.name as user_name, e.id as environment_id, e.key as environment_key,
      e.name as environment_name, e.class as environment_class, a.external_id as account
    from pipeline_variables v
    left join pipeline_environments e on e.id = v.environment_id
    left join users u on u.id = v.updated_by
    left join cloud_accounts a on a.id = v.secret_account_id
    where v.application_id = ${applicationId}
      and (${filter.environment ?? null}::text is null or v.environment_id is null
        or e.key = ${filter.environment ?? null}::text)
      and (${filter.name ?? null}::text is null or v.name = ${filter.name ?? null}::text)
    order by v.name, e.position nulls first, e.id`;
  return rows.map(present);
}

export async function selectEnvironmentRefs(
  sql: SqlExecutor,
  key?: string,
): Promise<EnvironmentRef[]> {
  const rows = await sql<{ id: string; key: string; name: string; class: string }[]>`
    select id, key, name, class from pipeline_environments
    where archived_at is null and (${key ?? null}::text is null or key = ${key ?? null}::text)
    order by position, id`;
  return rows.map((row) => ({ ...row, class: row.class as EnvironmentClass }));
}
