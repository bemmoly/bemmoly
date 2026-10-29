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

/** The repository the build step named, so a release points where the image was pushed. */
export function repositoryOf(steps: unknown, application: string): string {
  const named = Array.isArray(steps)
    ? (steps as Array<{ env?: Record<string, unknown> }>)
        .map((step) => step.env?.['BEMMOLY_BUILD_IMAGE'])
        .find((value): value is string => typeof value === 'string' && value.length > 0)
    : undefined;
  return named ?? `bemmoly-local/${application}`;
}

/** The application's deploy settings as the run resolved them; a release keeps them. */
export function deployConfigOf(spec: unknown, application: string): Record<string, unknown> {
  if (typeof spec !== 'object' || spec === null) return {};
  const value = spec as {
    deploy?: unknown;
    applications?: Array<{ key: string; pipeline?: { deploy?: unknown } }>;
  };
  const deploy = Array.isArray(value.applications)
    ? value.applications.find((entry) => entry.key === application)?.pipeline?.deploy
    : value.deploy;
  return deploy && typeof deploy === 'object' ? { deploy } : {};
}

interface Built {
  application_id: string;
  application_key: string;
  image_digests: Record<string, string>;
  steps_spec: unknown;
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
      resolved_spec: unknown;
      default_branch: string | null;
    }[]
  >`
    select r.state, r.trigger, r.ref, r.commit_sha, r.created_by, r.resolved_spec,
      p.default_branch
    from pipeline_runs r left join pipeline_repositories p on p.id = r.repository_id
    where r.id = ${runId}`;
  if (!run || run.state !== 'passed') return 0;
  if (run.trigger === 'pull_request' || run.trigger === 'merge_group') return 0;
  const tagged = TAG.test(run.ref);
  if (!tagged && run.ref !== (run.default_branch ?? 'main')) return 0;
  const built = await sql<Built[]>`
    select a.id as application_id, a.key as application_key, b.image_digests, b.steps_spec,
      coalesce(sum((j.test_summary->>'total')::int), 0)::int as total,
      coalesce(sum((j.test_summary->>'passed')::int), 0)::int as passed,
      coalesce(sum((j.test_summary->>'failed')::int), 0)::int as failed,
      coalesce(sum((j.test_summary->>'skipped')::int), 0)::int as skipped
    from pipeline_jobs b
    join pipeline_applications a on a.id = b.application_id
    left join pipeline_jobs j on j.run_id = b.run_id and j.application_id = b.application_id
    where b.run_id = ${runId} and b.kind = 'build' and b.state = 'passed'
      and b.image_digests is not null
    group by a.id, a.key, b.id, b.image_digests, b.steps_spec`;
  let created = 0;
  for (const build of built) {
    await sql.begin(async (tx) => {
      const result = await writer.createRelease(tx, {
        applicationId: build.application_id,
        version: versionOf(run.ref, run.commit_sha),
        source: 'runners',
        commitSha: run.commit_sha,
        ref: run.ref,
        imageRepository: repositoryOf(build.steps_spec, build.application_key),
        imageDigests: build.image_digests,
        resolvedConfig: deployConfigOf(run.resolved_spec, build.application_key),
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
