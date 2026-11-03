import type { SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type { ChangeEnvironmentRow } from '../../models/change-requests.ts';
import { previousEnvironment } from './rows.ts';

/*
 * The versions a request moves: one per service, each a release of that service, and when
 * the environment takes only versions that passed the one before it, one that deployed
 * there successfully. Versions move unchanged, so the release is what goes, never a rebuild.
 */

export interface ResolvedItem {
  applicationId: string;
  applicationKey: string;
  releaseId: string;
  version: string;
  fromReleaseId: string | null;
}

/** Release ids among `releaseIds` that deployed successfully to the environment. */
export async function passedIn(
  sql: SqlExecutor,
  environmentId: string,
  releaseIds: readonly string[],
): Promise<Set<string>> {
  if (releaseIds.length === 0) return new Set();
  const rows = await sql<{ release_id: string }[]>`
    select distinct release_id from pipeline_deployments
    where environment_id = ${environmentId} and state = 'succeeded' and kind = 'deploy'
      and release_id = any(${releaseIds as string[]}::uuid[])`;
  return new Set(rows.map((row) => row.release_id));
}

export async function resolveItems(
  sql: SqlExecutor,
  environment: ChangeEnvironmentRow,
  items: ReadonlyArray<{ application: string; releaseId: string }>,
): Promise<ResolvedItem[]> {
  const keys = items.map((item) => item.application);
  if (new Set(keys).size !== keys.length) {
    throw new ValidationError('Pick one version per service');
  }
  const rows = await sql<
    Array<{
      application_id: string;
      application_key: string;
      release_id: string | null;
      version: string | null;
      current_release_id: string | null;
    }>
  >`
    select a.id as application_id, a.key as application_key, r.id as release_id, r.version,
      c.release_id as current_release_id
    from jsonb_to_recordset(${JSON.stringify(items)}::jsonb) as wanted(application text, "releaseId" uuid)
    join pipeline_applications a on a.key = wanted.application
    left join pipeline_releases r on r.id = wanted."releaseId" and r.application_id = a.id
    left join pipeline_current c on c.application_id = a.id and c.environment_id = ${environment.id}`;
  const resolved: ResolvedItem[] = [];
  for (const item of items) {
    const row = rows.find((r) => r.application_key === item.application);
    if (!row) throw new NotFoundError(`There is no service called ${item.application}`);
    if (!row.release_id || !row.version) {
      throw new NotFoundError(`That version of ${item.application} does not exist`);
    }
    if (row.current_release_id === row.release_id) {
      throw new ConflictError(
        `${item.application} ${row.version} already runs in ${environment.name}`,
      );
    }
    resolved.push({
      applicationId: row.application_id,
      applicationKey: row.application_key,
      releaseId: row.release_id,
      version: row.version,
      fromReleaseId: row.current_release_id,
    });
  }
  if (environment.versions_allowed === 'passed_previous') {
    const previous = await previousEnvironment(sql, environment);
    const passed = previous
      ? await passedIn(
          sql,
          previous.id,
          resolved.map((item) => item.releaseId),
        )
      : null;
    const blocked = passed ? resolved.find((item) => !passed.has(item.releaseId)) : undefined;
    if (previous && blocked) {
      throw new ConflictError(
        `${environment.name} takes only versions that passed ${previous.name}. Deploy ${blocked.applicationKey} ${blocked.version} there first.`,
      );
    }
  }
  return resolved;
}
