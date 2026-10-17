import type { SqlExecutor } from '@bemmoly/core';
import { decodeCursor, toPage } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { EnvironmentClass, Tier } from '../../../../shared/common.ts';
import {
  provenanceSchema,
  releaseTestSummarySchema,
  type ListReleasesQuery,
  type Release,
  type ReleasesPage,
  type ReleaseSource,
} from '../../../../shared/releases.ts';
import { escapeLike, iso } from '../../utils/time.ts';

/* Releases as the release page, the application page and the Promote screen read them. */

interface Row {
  id: string;
  application_id: string;
  application_key: string;
  application_name: string;
  tier: number;
  version: string;
  source: string;
  run_id: string | null;
  run_number: number | null;
  commit_sha: string;
  ref: string | null;
  image_repository: string | null;
  image_digests: Record<string, string>;
  resolved_config: Record<string, unknown>;
  test_summary: unknown;
  provenance: unknown;
  sbom_object_key: string | null;
  notes: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  environments: Array<{ id: string; key: string; name: string; class: string }> | null;
}

const SELECT = `r.id, r.application_id, a.key as application_key, a.name as application_name,
  a.tier, r.version, r.source, r.run_id, run.number::int as run_number, r.commit_sha, r.ref,
  r.image_repository, r.image_digests, r.resolved_config, r.test_summary, r.provenance,
  r.sbom_object_key, r.notes, r.created_by, u.name as created_by_name, r.created_at,
  (select json_agg(json_build_object('id', e.id, 'key', e.key, 'name', e.name, 'class', e.class)
     order by e.position)
   from pipeline_current c join pipeline_environments e on e.id = c.environment_id
   where c.release_id = r.id) as environments
  from pipeline_releases r
  join pipeline_applications a on a.id = r.application_id
  join pipeline_domains d on d.id = a.domain_id
  join pipeline_groups g on g.id = a.group_id
  left join pipeline_runs run on run.id = r.run_id
  left join users u on u.id = r.created_by`;

function toRelease(row: Row): Release {
  const tests = releaseTestSummarySchema.safeParse(row.test_summary);
  const provenance = provenanceSchema.safeParse(row.provenance);
  return {
    id: row.id,
    application: {
      id: row.application_id,
      key: row.application_key,
      name: row.application_name,
      tier: row.tier as Tier,
    },
    version: row.version,
    source: row.source as ReleaseSource,
    run: row.run_id && row.run_number !== null ? { id: row.run_id, number: row.run_number } : null,
    commitSha: row.commit_sha,
    ref: row.ref,
    imageRepository: row.image_repository,
    imageDigests: row.image_digests,
    resolvedConfig: row.resolved_config,
    testSummary: tests.success ? tests.data : null,
    provenance: provenance.success ? provenance.data : null,
    hasSbom: row.sbom_object_key !== null,
    notes: row.notes,
    createdBy:
      row.created_by && row.created_by_name
        ? { id: row.created_by, name: row.created_by_name, avatarUrl: null }
        : null,
    createdAt: iso(row.created_at),
    environments: (row.environments ?? []).map((e) => ({
      ...e,
      class: e.class as EnvironmentClass,
    })),
  };
}

export async function listReleases(
  sql: SqlExecutor,
  query: ListReleasesQuery,
): Promise<ReleasesPage> {
  const after = decodeCursor(query.cursor);
  const [domain, group] = (query.scope ?? '').split('/');
  const q = query.q ? `%${escapeLike(query.q.toLowerCase())}%` : null;
  const rows = await sql<Row[]>`
    select ${sql.unsafe(SELECT)}
    where true
      ${domain ? sql`and d.key = ${domain}` : sql``}
      ${group ? sql`and g.key = ${group}` : sql``}
      ${query.application ? sql`and a.key = ${query.application}` : sql``}
      ${query.source ? sql`and r.source = ${query.source}` : sql``}
      ${q ? sql`and (lower(r.version) like ${q} or r.commit_sha like ${q} or lower(a.key) like ${q})` : sql``}
      ${after ? sql`and r.id < ${after}::uuid` : sql``}
    order by r.id desc limit ${query.limit + 1}`;
  const page = toPage(rows, query.limit);
  return { items: page.rows.map(toRelease), nextCursor: page.nextCursor };
}

export async function getRelease(sql: SqlExecutor, id: string): Promise<Release> {
  const [row] = await sql<Row[]>`select ${sql.unsafe(SELECT)} where r.id = ${id}`;
  if (!row) throw new NotFoundError('That release does not exist');
  return toRelease(row);
}
