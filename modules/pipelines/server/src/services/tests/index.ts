import { decodeCursor, toPage, type RequestContext, type SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  FailureGroups,
  ListFailuresQuery,
  ListTestsQuery,
  QuarantineBody,
  TestStatus,
  TestsPage,
} from '../../../../shared/tests.ts';
import { listFailuresQuerySchema, listTestsQuerySchema } from '../../../../shared/tests.ts';
import {
  authorizePipelines,
  requireAccess,
  requireDatabase,
  requirePerson,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { iso, isoOrNull } from '../../utils/time.ts';
import { normaliseFailure } from './fingerprint.ts';
import { splitByTiming } from './split.ts';

export { ingestReport, type ReportJob } from './report.ts';
export { fingerprintOf, normaliseFailure } from './fingerprint.ts';

/*
 * Flaky tests, quarantine and failure groups. Quarantine is the owning team's call: it
 * needs `manage` on the application (the owning team is Maintainer by default), and a
 * quarantined test keeps running and stays listed, it just no longer fails the run.
 */

interface TestRow {
  id: string;
  file: string;
  name: string;
  flaky: TestStatus['flaky'];
  flaky_since: Date | string | null;
  recent_outcomes: string;
  last_failed_at: Date | string | null;
  quarantined_at: Date | string | null;
  quarantine_reason: string | null;
  by_id: string | null;
  by_name: string | null;
  team_id: string | null;
  team_name: string | null;
}

function toStatus(row: TestRow): TestStatus {
  const recent = row.recent_outcomes;
  return {
    id: row.id,
    file: row.file,
    name: row.name,
    flaky: row.flaky,
    flakySince: isoOrNull(row.flaky_since),
    failedRecent: [...recent].filter((outcome) => outcome === 'f').length,
    ofRecent: recent.length,
    lastFailedAt: isoOrNull(row.last_failed_at),
    quarantine: row.quarantined_at
      ? {
          by: row.by_id ? { id: row.by_id, name: row.by_name ?? '', avatarUrl: null } : null,
          at: iso(row.quarantined_at),
          reason: row.quarantine_reason ?? '',
        }
      : null,
    owner: row.team_id ? { id: row.team_id, name: row.team_name ?? '' } : null,
  };
}

async function applicationId(sql: SqlExecutor, key: string): Promise<string> {
  const [app] = await sql<{ id: string }[]>`
    select id from pipeline_applications where key = ${key} and archived_at is null`;
  if (!app) throw new NotFoundError(`There is no application called ${key}`);
  return app.id;
}

const select = (sql: SqlExecutor) => sql`
  select t.id, t.file, t.name, t.flaky, t.flaky_since, t.recent_outcomes, t.last_failed_at,
    t.quarantined_at, t.quarantine_reason, u.id as by_id, u.name as by_name,
    tm.id as team_id, tm.name as team_name
  from pipeline_tests t
  join pipeline_applications a on a.id = t.application_id
  left join teams tm on tm.id = a.owner_team_id
  left join users u on u.id = t.quarantined_by`;

export function createTestsService(deps: PipelinesServiceDeps) {
  return {
    async list(ctx: RequestContext, key: string, input: ListTestsQuery): Promise<TestsPage> {
      await authorizePipelines(ctx);
      const query = listTestsQuerySchema.parse(input);
      const sql = requireDatabase(deps);
      const app = await applicationId(sql, key);
      const after = decodeCursor(query.cursor);
      const rows = await sql<TestRow[]>`
        ${select(sql)}
        where t.application_id = ${app}
          ${query.state === 'flaky' ? sql`and t.flaky is not null` : sql``}
          ${query.state === 'quarantined' ? sql`and t.quarantined_at is not null` : sql``}
          ${after ? sql`and t.id < ${after}::uuid` : sql``}
        order by t.id desc limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toStatus), nextCursor: page.nextCursor };
    },

    async quarantine(ctx: RequestContext, key: string, body: QuarantineBody): Promise<TestStatus> {
      await requireAccess(deps).authorizeAction(ctx, 'manage', { application: key });
      const person = requirePerson(ctx.actor);
      const sql = requireDatabase(deps);
      const app = await applicationId(sql, key);
      const [row] = await sql<{ id: string }[]>`
        insert into pipeline_tests (application_id, file, name, quarantined_at, quarantined_by,
          quarantine_reason)
        values (${app}, ${body.file}, ${body.name}, now(), ${person}, ${body.reason})
        on conflict (application_id, file, name) do update set quarantined_at = now(),
          quarantined_by = ${person}, quarantine_reason = ${body.reason}, updated_at = now()
        returning id`;
      const [status] = await sql<TestRow[]>`${select(sql)} where t.id = ${row?.id ?? null}::uuid`;
      if (!status) throw new NotFoundError('That test does not exist');
      return toStatus(status);
    },

    async release(ctx: RequestContext, key: string, id: string): Promise<void> {
      await requireAccess(deps).authorizeAction(ctx, 'manage', { application: key });
      const sql = requireDatabase(deps);
      const app = await applicationId(sql, key);
      const updated = await sql`
        update pipeline_tests set quarantined_at = null, quarantined_by = null,
          quarantine_reason = null, updated_at = now()
        where id = ${id} and application_id = ${app} returning id`;
      if (updated.length === 0) throw new NotFoundError('That test is not in this application');
    },

    /** Identical failures across runs, newest first: "this failure hit 14 services". */
    async failures(ctx: RequestContext, input: ListFailuresQuery): Promise<FailureGroups> {
      await authorizePipelines(ctx);
      const query = listFailuresQuerySchema.parse(input);
      const sql = requireDatabase(deps);
      const since = query.since ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
      const [domain, group] = (query.scope ?? '').split('/');
      const rows = await sql<
        {
          fingerprint: string;
          sample: string;
          occurrences: number;
          runs: number;
          applications: Array<{ id: string; key: string; name: string; tier: number }> | null;
          first_seen: Date | string;
          last_seen: Date | string;
          latest_job_id: string;
        }[]
      >`
        select f.fingerprint,
          (array_agg(f.line order by f.created_at desc))[1] as sample,
          count(*)::int as occurrences, count(distinct f.run_id)::int as runs,
          json_agg(distinct jsonb_build_object('id', a.id, 'key', a.key, 'name', a.name,
            'tier', a.tier)) filter (where a.id is not null) as applications,
          min(f.created_at) as first_seen, max(f.created_at) as last_seen,
          (array_agg(f.job_id order by f.created_at desc))[1] as latest_job_id
        from pipeline_job_failures f
        left join pipeline_applications a on a.id = f.application_id
        left join pipeline_domains d on d.id = a.domain_id
        left join pipeline_groups g on g.id = a.group_id
        where f.created_at >= ${since}::timestamptz
          ${query.fingerprint ? sql`and f.fingerprint = ${query.fingerprint}` : sql``}
          ${query.application ? sql`and a.key = ${query.application}` : sql``}
          ${domain ? sql`and d.key = ${domain}` : sql``}
          ${group ? sql`and g.key = ${group}` : sql``}
        group by f.fingerprint
        order by max(f.created_at) desc limit ${query.limit}`;
      return {
        items: rows.map((row) => ({
          fingerprint: row.fingerprint,
          text: normaliseFailure(row.sample),
          sample: row.sample,
          occurrences: row.occurrences,
          runs: row.runs,
          applications: (row.applications ?? []).map((a) => ({ ...a, tier: a.tier as 0 | 1 | 2 })),
          firstSeenAt: iso(row.first_seen),
          lastSeenAt: iso(row.last_seen),
          latestJobId: row.latest_job_id,
        })),
      };
    },

    /** The files one shard runs; every shard of the job computes the same split. */
    async splits(
      sql: SqlExecutor,
      job: {
        application_id: string | null;
        shard_index: number | null;
        shard_total: number | null;
      },
      files: readonly string[],
    ) {
      const timings = job.application_id
        ? await sql<{ test_file: string; duration_ms: number }[]>`
            select test_file, duration_ms from pipeline_test_timings
            where application_id = ${job.application_id}`
        : [];
      const plan = splitByTiming(
        files,
        new Map(timings.map((row) => [row.test_file, row.duration_ms])),
        job.shard_total ?? 1,
      );
      const index = (job.shard_index ?? 1) - 1;
      return { files: plan.files[index] ?? [], expectedSeconds: plan.seconds[index] ?? 0 };
    },
  };
}

export type TestsService = ReturnType<typeof createTestsService>;
