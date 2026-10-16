import type { SqlExecutor } from '@bemmoly/core';
import type { ExternalCheck } from '../../../../shared/ci.ts';
import type { ExternalCheckRow } from '../../models/ci.ts';
import type { InboxHandlers } from '../inbox/handlers.ts';
import { iso } from '../../utils/time.ts';

/*
 * Other CI systems' results per commit (architecture §7.1): GitHub check runs and workflow
 * runs arrive through the inbox and are kept, newest state per name, so a policy can require
 * "workflow security.yml passed" as a gate. An older report never overwrites a newer one.
 */

const PASSING = new Set(['success', 'neutral', 'skipped']);

export function verdictOf(
  row: Pick<ExternalCheckRow, 'status' | 'conclusion'>,
): ExternalCheck['verdict'] {
  if (row.status !== 'completed') return 'pending';
  return PASSING.has(row.conclusion ?? '') ? 'pass' : 'fail';
}

async function upsertCheck(
  sql: SqlExecutor,
  check: {
    repository: string;
    sha: string;
    kind: 'check_run' | 'workflow_run';
    name: string;
    path: string | null;
    status: string;
    conclusion: string | null;
    url: string | null;
    occurredAt: string;
  },
): Promise<void> {
  await sql`
    insert into pipeline_external_checks
      (repository_full_name, commit_sha, kind, name, path, status, conclusion, url, occurred_at)
    values (${check.repository}, ${check.sha}, ${check.kind}, ${check.name}, ${check.path},
      ${check.status}, ${check.conclusion}, ${check.url}, ${check.occurredAt}::timestamptz)
    on conflict (lower(repository_full_name), commit_sha, kind, name) do update set
      path = excluded.path, status = excluded.status, conclusion = excluded.conclusion,
      url = excluded.url, occurred_at = excluded.occurred_at, updated_at = now()
    where pipeline_external_checks.occurred_at <= excluded.occurred_at`;
}

/** Keeps check and workflow runs that other apps report; our own checks are skipped. */
export function registerExternalChecks(
  handlers: InboxHandlers,
  sql: () => SqlExecutor,
  ownApp: string | null,
) {
  handlers.on('check_run', async (event) => {
    if (ownApp && event.app === ownApp) return;
    await upsertCheck(sql(), {
      repository: event.repository,
      sha: event.headSha,
      kind: 'check_run',
      name: event.name,
      path: null,
      status: event.status,
      conclusion: event.conclusion,
      url: event.url,
      occurredAt: event.occurredAt,
    });
  });
  handlers.on('workflow_run', async (event) => {
    await upsertCheck(sql(), {
      repository: event.repository,
      sha: event.headSha,
      kind: 'workflow_run',
      // Policies name workflows by file: "security.yml".
      name: event.path.split('/').pop() ?? event.path,
      path: event.path,
      status: event.status,
      conclusion: event.conclusion,
      url: event.url,
      occurredAt: event.occurredAt,
    });
  });
}

/**
 * Every external result for one commit of one repository, for gates and the Promote screen.
 * Gates match the commit exactly: a short sha also matches a commit someone made to share its
 * first characters, and that commit's passing checks would open the gate. Only a person
 * looking a commit up by its short sha gets the prefix match.
 */
export async function externalChecksFor(
  sql: SqlExecutor,
  repository: string,
  commitSha: string,
  match: 'exact' | 'prefix' = 'exact',
): Promise<ExternalCheck[]> {
  const prefix = match === 'prefix' ? `${commitSha}%` : commitSha;
  const rows = await sql<ExternalCheckRow[]>`
    select kind, name, path, status, conclusion, url, occurred_at from pipeline_external_checks
    where lower(repository_full_name) = lower(${repository})
      and (commit_sha = ${commitSha} or commit_sha like ${prefix})
    order by kind, name`;
  return rows.map((row) => ({
    kind: row.kind,
    name: row.name,
    path: row.path,
    status: row.status,
    conclusion: row.conclusion,
    verdict: verdictOf(row),
    url: row.url,
    occurredAt: iso(row.occurred_at),
  }));
}
