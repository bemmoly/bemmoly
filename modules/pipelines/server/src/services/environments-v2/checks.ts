import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type {
  ApprovalRule,
  CreateEnvironmentV2Body,
  EnvironmentDeployers,
} from '../../../../shared/environments-v2.ts';

/* What an environment's settings must point at before they are stored. */

type ProjectInput = NonNullable<CreateEnvironmentV2Body['project']>;

export interface ResolvedProject {
  provider: string;
  cloudAccountId: string;
  region: string | null;
}

/**
 * The cloud account behind a project the person picked: by its id, or by the project ID among
 * the projects Bemmoly can reach on that cloud. Only reachable projects can be linked.
 */
export async function resolveProject(
  sql: SqlExecutor,
  project: ProjectInput,
): Promise<ResolvedProject> {
  const [account] = await sql<{ id: string; provider: string; status: string }[]>`
    select a.id, c.provider, a.status
    from cloud_accounts a join cloud_connections c on c.id = a.connection_id
    where c.provider = ${project.provider}
      and (case when ${project.cloudAccountId ?? null}::uuid is not null
        then a.id = ${project.cloudAccountId ?? null}::uuid
        else a.external_id = ${project.externalId} end)
    order by (a.status = 'ready') desc, a.created_at
    limit 1`;
  if (!account) {
    throw new ValidationError(
      `Bemmoly cannot reach ${project.externalId}. Connect it on Platform › Clouds first`,
    );
  }
  if (account.status === 'failed') {
    throw new ValidationError(
      `${project.externalId} failed its last access check. Grant what it found, check again, then link it`,
    );
  }
  return { provider: account.provider, cloudAccountId: account.id, region: project.region };
}

/** Every step must name an approval group that exists. */
export async function checkRule(sql: SqlExecutor, rule: ApprovalRule | undefined): Promise<void> {
  if (!rule) return;
  const ids = [...new Set(rule.steps.map((step) => step.group))];
  const found = await sql<{ id: string }[]>`
    select id from pipeline_approval_groups where id = any(${ids}::uuid[])`;
  if (found.length !== ids.length) {
    throw new NotFoundError('An approval step names a group that does not exist');
  }
}

/** Named deployers must be people and groups that exist. */
export async function checkDeployers(
  sql: SqlExecutor,
  deployers: EnvironmentDeployers | undefined,
): Promise<void> {
  if (!deployers) return;
  if (deployers.users.length > 0) {
    const users = await sql<{ id: string }[]>`
      select id from users where id = any(${deployers.users}::uuid[])`;
    if (users.length !== new Set(deployers.users).size) {
      throw new NotFoundError('Someone named to deploy here is not a person on this install');
    }
  }
  if (deployers.groups.length > 0) {
    const groups = await sql<{ id: string }[]>`
      select id from pipeline_approval_groups where id = any(${deployers.groups}::uuid[])`;
    if (groups.length !== new Set(deployers.groups).size) {
      throw new NotFoundError('A group named to deploy here does not exist');
    }
  }
}

export const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';

export const jsonOrNull = (value: unknown) =>
  value === null || value === undefined ? null : JSON.stringify(value);
