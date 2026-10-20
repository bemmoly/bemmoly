import type { SqlClient } from '@bemmoly/core';
import type { RepositoryInput } from '../../../../shared/catalog-writes.ts';
import type { DiscoveryStatus } from '../../../../shared/discovery.ts';
import { upsertRepository } from '../catalog-writes/repositories.ts';
import type { RepositoryReader } from '../code/repository-reader.ts';
import { iso, isoOrNull } from '../../utils/time.ts';

/*
 * A sweep: ask the connected hosts which repositories Pipelines may read, remember each, and
 * ask for a scan of those never scanned (or of all of them, on a rescan). Each repository
 * records when its scan was asked for and why the last one failed, so the status can count.
 */

export type RepositoryRef = Pick<RepositoryInput, 'fullName'> & Partial<RepositoryInput>;

export interface SweepResult {
  repositories: number;
  queued: number;
}

/** Sweeps are kept a week: enough to see when discovery last looked. */
const KEEP_SWEEPS = '7 days';
/** A sweep not finished by then died with its process; it no longer counts as running. */
const SWEEP_STALE = '10 minutes';
const NO_HOST = 'No code host is connected. Connect GitHub in Settings › Code hosts.';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function sweepRepositories(
  sql: SqlClient,
  reader: RepositoryReader,
  rescan: boolean,
  request: (repositories: RepositoryRef[], requestedAt: Date) => Promise<void>,
): Promise<SweepResult> {
  const [sweep] = await sql<{ id: string }[]>`
    insert into pipeline_discovery_sweeps (rescan) values (${rescan}) returning id`;
  const finish = (repositories: number | null, queued: number, error: string | null) => sql`
    update pipeline_discovery_sweeps
    set finished_at = now(), repositories = ${repositories}, queued = ${queued}, error = ${error}
    where id = ${sweep?.id ?? null}::uuid`;
  let visible;
  try {
    visible = await reader.visible();
  } catch (error) {
    await finish(null, 0, messageOf(error));
    throw error;
  }
  if (!visible) {
    await finish(null, 0, NO_HOST);
    return { repositories: 0, queued: 0 };
  }
  const listed = visible;
  const asked = await sql.begin(async (tx) => {
    for (const repository of listed) {
      await upsertRepository(tx, {
        fullName: repository.fullName,
        provider: repository.provider,
        ...(repository.defaultBranch ? { defaultBranch: repository.defaultBranch } : {}),
        url: repository.url,
      });
    }
    const names = listed.map((repository) => repository.fullName.toLowerCase());
    return tx<
      {
        full_name: string;
        provider: RepositoryInput['provider'];
        default_branch: string;
        at: Date | string;
      }[]
    >`
      update pipeline_repositories
      set discovery_requested_at = now(), discovery_error = null, updated_at = now()
      where lower(full_name) = any(${names}::text[]) and archived_at is null
        ${rescan ? tx`` : tx`and discovered_at is null and discovery_requested_at is null`}
      returning full_name, provider, default_branch, discovery_requested_at as at`;
  });
  const at = asked[0]?.at;
  if (at !== undefined) {
    await request(
      asked.map((row) => ({
        fullName: row.full_name,
        provider: row.provider,
        defaultBranch: row.default_branch,
      })),
      new Date(at),
    );
  }
  await finish(listed.length, asked.length, null);
  await sql`delete from pipeline_discovery_sweeps
    where started_at < now() - ${KEEP_SWEEPS}::interval`;
  return { repositories: listed.length, queued: asked.length };
}

/** A scan that could not read its repository says why, until a later scan succeeds. */
export async function recordScanFailure(
  sql: SqlClient,
  repository: RepositoryRef,
  error: unknown,
): Promise<void> {
  const row = await upsertRepository(sql, repository);
  await sql`update pipeline_repositories set discovery_error = ${messageOf(error)},
      updated_at = now()
    where id = ${row.id}::uuid`;
}

export async function discoveryStatus(sql: SqlClient): Promise<DiscoveryStatus> {
  const [[counts], [last]] = await Promise.all([
    sql<{ repositories: number; scanned: number; failed: number; pending: number }[]>`
      select count(*)::int as repositories,
        count(*) filter (where discovery_error is null and discovered_at is not null
          and (discovery_requested_at is null or discovered_at >= discovery_requested_at))::int
          as scanned,
        count(*) filter (where discovery_error is not null)::int as failed,
        count(*) filter (where discovery_error is null and discovery_requested_at is not null
          and (discovered_at is null or discovered_at < discovery_requested_at))::int as pending
      from pipeline_repositories
      where archived_at is null
        and (discovered_at is not null or discovery_requested_at is not null)`,
    sql<
      {
        started_at: Date | string;
        finished_at: Date | string | null;
        repositories: number | null;
        error: string | null;
        running: boolean;
      }[]
    >`
      select started_at, finished_at, repositories, error,
        finished_at is null and started_at > now() - ${SWEEP_STALE}::interval as running
      from pipeline_discovery_sweeps order by started_at desc limit 1`,
  ]);
  return {
    repositories: counts?.repositories ?? 0,
    scanned: counts?.scanned ?? 0,
    failed: counts?.failed ?? 0,
    scanning: (counts?.pending ?? 0) > 0 || last?.running === true,
    lastSweep: last
      ? {
          startedAt: iso(last.started_at),
          finishedAt: isoOrNull(last.finished_at),
          repositories: last.repositories,
          error: last.error,
        }
      : null,
  };
}
