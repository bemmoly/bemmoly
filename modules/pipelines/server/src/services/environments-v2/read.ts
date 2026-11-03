import type { SqlExecutor } from '@bemmoly/core';
import {
  approvalRuleSchema,
  deployWindowSchema,
  environmentDeployersSchema,
  versionsAllowedSchema,
  type ApprovalRule,
  type EnvironmentV2View,
} from '../../../../shared/environments-v2.ts';
import type { Provider } from '../../../../shared/common.ts';
import type { ApprovalGroupNameRow, EnvironmentV2Row } from '../../models/environments-v2.ts';

/*
 * Equal environments as screens read them: left to right on the one path, each optional
 * setting as stored (null when off), and each approval step with its group's name. Stored
 * jsonb is parsed so a value written by an older release still reads as "off", never as junk.
 */

const lenient = <T>(parse: (value: unknown) => T, value: unknown, fallback: T): T => {
  try {
    return value === null || value === undefined ? fallback : parse(value);
  } catch {
    return fallback;
  }
};

export const ruleOf = (value: unknown): ApprovalRule =>
  lenient((v) => approvalRuleSchema.parse(v), value, null);

function toView(row: EnvironmentV2Row, groups: Map<string, string>): EnvironmentV2View {
  const approvalRule = ruleOf(row.approval_rule);
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    position: row.position,
    project: row.account_external_id
      ? {
          provider: row.provider as Provider,
          externalId: row.account_external_id,
          name: row.account_name,
          region: row.region,
          cloudAccountId: row.cloud_account_id,
        }
      : null,
    deployers: lenient((v) => environmentDeployersSchema.parse(v), row.deployers, null),
    approvalRule,
    window: lenient((v) => deployWindowSchema.parse(v), row.deploy_window, null),
    versionsAllowed: lenient((v) => versionsAllowedSchema.parse(v), row.versions_allowed, 'any'),
    approvalSteps: (approvalRule?.steps ?? []).map((step) => ({
      ...step,
      groupRef: { id: step.group, name: groups.get(step.group) ?? 'A removed group' },
    })),
    serviceCount: row.service_count,
  };
}

/** Live environments left to right, or only the one called `key`. */
export async function selectEnvironmentsV2(
  sql: SqlExecutor,
  key?: string,
): Promise<EnvironmentV2View[]> {
  const rows = await sql<EnvironmentV2Row[]>`
    select e.id, e.key, e.name, e.position, e.provider, e.region, e.cloud_account_id,
      a.external_id as account_external_id, a.name as account_name, e.deployers,
      e.approval_rule, e.deploy_window, e.versions_allowed,
      (select count(distinct c.application_id)::int from pipeline_current c
        where c.environment_id = e.id and c.release_id is not null) as service_count
    from pipeline_environments e
    left join cloud_accounts a on a.id = e.cloud_account_id
    where e.archived_at is null and (${key ?? null}::text is null or e.key = ${key ?? null})
    order by e.position, e.id`;
  const groups = await sql<ApprovalGroupNameRow[]>`select id, name from pipeline_approval_groups`;
  const names = new Map(groups.map((group) => [group.id, group.name]));
  return rows.map((row) => toView(row, names));
}
