import type { SqlExecutor } from '@bemmoly/core';
import type { VersionScheme } from '../../../../shared/pipeline-setup.ts';

/*
 * How a passing build is numbered (product rule 6), as the service's setup chose: from commit
 * messages (semver: a breaking change bumps major, "feat" minor, anything else patch), a
 * build number counting up, the git tag that was pushed, or the commit alone. A service that
 * chose nothing keeps the older rule: the tag when there is one, else the short commit.
 */

const TAG = /^(refs\/tags\/)?(v?\d+\.\d+\.\d+[0-9A-Za-z.+-]*)$/;
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

export type Bump = 'major' | 'minor' | 'patch';

/** The bump a set of conventional commit messages asks for; patch when none says more. */
export function bumpOf(messages: readonly string[]): Bump {
  let bump: Bump = 'patch';
  for (const message of messages) {
    const subject = message.split('\n', 1)[0] ?? '';
    if (/^[a-z]+(\([^)]*\))?!:/.test(subject) || /^BREAKING[ -]CHANGE:/m.test(message)) {
      return 'major';
    }
    if (/^feat(\([^)]*\))?:/.test(subject)) bump = 'minor';
  }
  return bump;
}

/** The next semantic version after `previous`, or 0.1.0 for a service's first. */
export function nextSemver(previous: string | null, messages: readonly string[]): string {
  const match = previous ? SEMVER.exec(previous) : null;
  if (!match) return '0.1.0';
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const bump = bumpOf(messages);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function legacyVersion(ref: string, commitSha: string): string {
  return TAG.exec(ref)?.[2] ?? commitSha.slice(0, 7);
}

export interface VersionInput {
  scheme: VersionScheme | null;
  applicationId: string;
  ref: string;
  commitSha: string;
  messages: readonly string[];
}

export async function versionFor(sql: SqlExecutor, input: VersionInput): Promise<string> {
  const short = input.commitSha.slice(0, 7);
  switch (input.scheme) {
    case null:
      return legacyVersion(input.ref, input.commitSha);
    case 'commit':
      return short;
    case 'git_tag':
      // A build of a branch has no tag to name it; the commit says exactly what it is.
      return TAG.exec(input.ref)?.[2] ?? short;
    case 'build_number': {
      const [row] = await sql<{ last: number | null }[]>`
        select max(version::bigint)::int as last from pipeline_releases
        where application_id = ${input.applicationId} and version ~ '^[0-9]{1,15}$'`;
      return String((row?.last ?? 0) + 1);
    }
    case 'semver_commits': {
      const [row] = await sql<{ version: string }[]>`
        select version from pipeline_releases
        where application_id = ${input.applicationId} and version ~ '^v?[0-9]+\\.[0-9]+\\.[0-9]+$'
        order by created_at desc, id desc limit 1`;
      return nextSemver(row?.version ?? null, input.messages);
    }
  }
}

/**
 * The version a run makes for its application, worked out once and kept on the run, so a
 * deploy step mid-run and the release at the end name the same version.
 */
export async function runVersion(
  sql: SqlExecutor,
  runId: string,
  applicationId: string,
): Promise<string> {
  const [run] = await sql<
    {
      version: string | null;
      ref: string;
      commit_sha: string;
      commit_messages: string[];
      scheme: VersionScheme | null;
      single: boolean;
    }[]
  >`
    select r.version, r.ref, r.commit_sha, r.commit_messages, a.version_scheme as scheme,
      (select count(*) from pipeline_run_applications ra where ra.run_id = r.id) <= 1 as single
    from pipeline_runs r join pipeline_applications a on a.id = ${applicationId}
    where r.id = ${runId}`;
  if (!run) return '';
  if (run.version && run.single) return run.version;
  const version = await versionFor(sql, {
    scheme: run.scheme,
    applicationId,
    ref: run.ref,
    commitSha: run.commit_sha,
    messages: run.commit_messages,
  });
  if (run.single) await sql`update pipeline_runs set version = ${version} where id = ${runId}`;
  return version;
}
