import type { SqlClient } from '@bemmoly/core';
import type { ReleaseWriter } from '../releases/index.ts';

/*
 * A passing build becomes a release (architecture §11): once a run on the default branch or
 * a tag passes, each application whose build job reported an image gets an immutable
 * release through the shared writer. The version is the tag when the run built one, else
 * the short commit. Pull request and merge queue runs never make releases.
 */

export const RELEASE_FROM_RUN_JOB = 'pipelines.release-from-run';

const TAG = /^(refs\/tags\/)?(v?\d+\.\d+\.\d+[0-9A-Za-z.+-]*)$/;

export function versionOf(ref: string, commitSha: string): string {
  return TAG.exec(ref)?.[2] ?? commitSha.slice(0, 7);
}

interface Built {
  application_id: string;
  application_key: string;
  image_digests: Record<string, string>;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export async function releaseFromRun(
  sql: SqlClient,
  writer: ReleaseWriter,
  runId: string,
): Promise<number> {
  const [run] = await sql<
    {
      state: string;
      trigger: string;
      ref: string;
      commit_sha: string;
      created_by: string | null;
      default_branch: string | null;
    }[]
  >`
    select r.state, r.trigger, r.ref, r.commit_sha, r.created_by, p.default_branch
    from pipeline_runs r left join pipeline_repositories p on p.id = r.repository_id
    where r.id = ${runId}`;
  if (!run || run.state !== 'passed') return 0;
  if (run.trigger === 'pull_request' || run.trigger === 'merge_group') return 0;
  const tagged = TAG.test(run.ref);
  if (!tagged && run.ref !== (run.default_branch ?? 'main')) return 0;
  const built = await sql<Built[]>`
    select a.id as application_id, a.key as application_key, b.image_digests,
      coalesce(sum((j.test_summary->>'total')::int), 0)::int as total,
      coalesce(sum((j.test_summary->>'passed')::int), 0)::int as passed,
      coalesce(sum((j.test_summary->>'failed')::int), 0)::int as failed,
      coalesce(sum((j.test_summary->>'skipped')::int), 0)::int as skipped
    from pipeline_jobs b
    join pipeline_applications a on a.id = b.application_id
    left join pipeline_jobs j on j.run_id = b.run_id and j.application_id = b.application_id
    where b.run_id = ${runId} and b.kind = 'build' and b.state = 'passed'
      and b.image_digests is not null
    group by a.id, a.key, b.id, b.image_digests`;
  let created = 0;
  for (const build of built) {
    await sql.begin(async (tx) => {
      const result = await writer.createRelease(tx, {
        applicationId: build.application_id,
        version: versionOf(run.ref, run.commit_sha),
        source: 'pipeline',
        commitSha: run.commit_sha,
        ref: run.ref,
        imageRepository: `bemmoly-local/${build.application_key}`,
        imageDigests: build.image_digests,
        testSummary: {
          total: build.total,
          passed: build.passed,
          failed: build.failed,
          skipped: build.skipped,
        },
        createdBy: run.created_by,
        runId,
      });
      if (result.created) created += 1;
    });
  }
  return created;
}
