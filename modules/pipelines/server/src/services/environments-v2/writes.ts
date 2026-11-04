import type { SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  CreateEnvironmentV2Body,
  ReorderEnvironmentsBody,
  UpdateEnvironmentV2Body,
} from '../../../../shared/environments-v2.ts';
import {
  checkDeployers,
  checkRule,
  isUniqueViolation,
  jsonOrNull,
  resolveProject,
} from './checks.ts';

/*
 * Writes of equal environments. A new environment has no class (product rule 3): nothing about
 * it is guarded unless the person turns a setting on, so `protection` stays empty and every
 * optional setting starts as the body says, which is off unless the person chose otherwise.
 */

const OPEN_PROMOTIONS = ['requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out'];

const taken = (key: string) =>
  new ConflictError(`An environment with the ID ${key} exists already; choose another ID`);

export async function insertEnvironment(
  sql: SqlExecutor,
  body: CreateEnvironmentV2Body,
): Promise<void> {
  const project = body.project ? await resolveProject(sql, body.project) : null;
  await checkRule(sql, body.approvalRule);
  await checkDeployers(sql, body.deployers);
  const [last] = await sql<{ next: number }[]>`
    select coalesce(max(position) + 1, 0)::int as next from pipeline_environments
    where archived_at is null`;
  const position = Math.min(body.position ?? last?.next ?? 0, last?.next ?? 0);
  // Making room keeps the path a plain 0..n-1 order.
  await sql`
    update pipeline_environments set position = position + 1, updated_at = now()
    where archived_at is null and position >= ${position}`;
  try {
    await sql`
      insert into pipeline_environments
        (key, name, class, provider, cloud_account_id, region, position, protection, deployers,
         approval_rule, deploy_window, versions_allowed)
      values (${body.key}, ${body.name}, null, ${project?.provider ?? 'gcp'},
        ${project?.cloudAccountId ?? null}, ${project?.region ?? null}, ${position}, '{}'::jsonb,
        ${jsonOrNull(body.deployers)}::jsonb, ${jsonOrNull(body.approvalRule)}::jsonb,
        ${jsonOrNull(body.window)}::jsonb, ${body.versionsAllowed})`;
  } catch (error) {
    if (isUniqueViolation(error)) throw taken(body.key);
    throw error;
  }
}

async function requireLive(sql: SqlExecutor, key: string) {
  const [row] = await sql<{ id: string; position: number }[]>`
    select id, position from pipeline_environments where key = ${key} and archived_at is null`;
  if (!row) throw new NotFoundError(`No environment has the ID ${key}`);
  return row;
}

/** Only what the body names changes; null turns an optional setting off. Answers the key. */
export async function updateEnvironment(
  sql: SqlExecutor,
  key: string,
  body: UpdateEnvironmentV2Body,
): Promise<string> {
  const current = await requireLive(sql, key);
  const project = body.project ? await resolveProject(sql, body.project) : null;
  await checkRule(sql, body.approvalRule ?? undefined);
  await checkDeployers(sql, body.deployers ?? undefined);
  const has = (field: keyof UpdateEnvironmentV2Body) => body[field] !== undefined;
  try {
    await sql`
      update pipeline_environments set
        name = coalesce(${body.name ?? null}, name),
        key = coalesce(${body.key ?? null}, key),
        provider = coalesce(${project?.provider ?? null}, provider),
        cloud_account_id = case when ${has('project')}
          then ${project?.cloudAccountId ?? null}::uuid else cloud_account_id end,
        region = case when ${has('project')} then ${project?.region ?? null} else region end,
        deployers = case when ${has('deployers')}
          then ${jsonOrNull(body.deployers)}::jsonb else deployers end,
        approval_rule = case when ${has('approvalRule')}
          then ${jsonOrNull(body.approvalRule)}::jsonb else approval_rule end,
        deploy_window = case when ${has('window')}
          then ${jsonOrNull(body.window)}::jsonb else deploy_window end,
        versions_allowed = coalesce(${body.versionsAllowed ?? null}, versions_allowed),
        updated_at = now()
      where id = ${current.id}`;
  } catch (error) {
    if (isUniqueViolation(error)) throw taken(body.key ?? key);
    throw error;
  }
  // A project chosen here wins over one a landing zone mapped for every domain.
  if (has('project')) {
    await sql`
      delete from pipeline_environment_accounts
      where environment_id = ${current.id} and domain_id is null`;
  }
  return body.key ?? key;
}

/** Removes an environment from the path; its history stays, and its ID is free again. */
export async function removeEnvironment(sql: SqlExecutor, key: string): Promise<void> {
  const current = await requireLive(sql, key);
  const [open] = await sql<{ count: number }[]>`
    select count(*)::int as count from pipeline_promotions
    where environment_id = ${current.id} and state = any(${OPEN_PROMOTIONS}::text[])`;
  if ((open?.count ?? 0) > 0) {
    throw new ConflictError(
      `${open?.count} deploys to ${key} are still open. Let them finish or cancel them first`,
    );
  }
  await sql`delete from pipeline_environment_path_steps where environment_id = ${current.id}`;
  await sql`
    update pipeline_environments set archived_at = now(), updated_at = now()
    where id = ${current.id}`;
  await sql`
    update pipeline_environments set position = position - 1, updated_at = now()
    where archived_at is null and position > ${current.position}`;
}

/** The whole path in its new order: every live environment, each once. */
export async function reorderEnvironments(
  sql: SqlExecutor,
  body: ReorderEnvironmentsBody,
): Promise<void> {
  const live = await sql<{ key: string }[]>`
    select key from pipeline_environments where archived_at is null`;
  const keys = new Set(live.map((row) => row.key));
  if (keys.size !== body.keys.length || body.keys.some((key) => !keys.has(key))) {
    throw new ValidationError('Name every environment once, in the order versions move');
  }
  for (const [position, key] of body.keys.entries()) {
    await sql`
      update pipeline_environments set position = ${position}, updated_at = now()
      where key = ${key} and archived_at is null`;
  }
}
