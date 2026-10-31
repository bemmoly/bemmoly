import type { ClaimedJob, ResolvedStep } from '@bemmoly/module-pipelines/shared';
import type { StepExecutor } from '../executors/index.ts';
import { dim } from '../utils/lines.ts';

const quote = (value: string): string => `'${value.replace(/'/g, `'\\''`)}'`;

/** A clone URL can carry a token as its password; the log must never show it. */
export function cloneCredentials(cloneUrl: string): string[] {
  try {
    const url = new URL(cloneUrl);
    return [url.password, url.username].filter((part) => part.length >= 8).map(decodeURIComponent);
  } catch {
    return [];
  }
}

/** The clone URL with any credential taken out, for what stays in the workspace. */
export function withoutCredentials(cloneUrl: string): string {
  try {
    const url = new URL(cloneUrl);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return cloneUrl;
  }
}

/**
 * Fetches exactly the commit the run is for: one shallow fetch, no branch history. The fetch
 * names the URL itself, so a checkout token is used once and never written to .git/config,
 * where the pipeline's own steps could read it back.
 */
export function checkoutCommand(job: ClaimedJob): string {
  const { cloneUrl, commitSha } = job.repository;
  return [
    'git init -q .',
    `git remote add origin ${quote(withoutCredentials(cloneUrl))}`,
    `git fetch --depth 1 --no-tags ${quote(cloneUrl)} ${quote(commitSha)}`,
    'git -c advice.detachedHead=false checkout -q FETCH_HEAD',
    'git log -1 --format="%h %s"',
  ].join(' && ');
}

/**
 * Checks out the repository into the workspace as the log's "Check out" phase, which is not a
 * step: it has no step row and no step position.
 */
export async function checkout(
  job: ClaimedJob,
  executor: StepExecutor,
  workspace: string,
  line: (text: string) => void,
): Promise<{ ok: boolean; exitCode: number }> {
  line(dim(`Check out ${job.repository.fullName} at ${job.repository.commitSha.slice(0, 12)}`));
  const step: ResolvedStep = {
    key: 'checkout',
    name: 'Check out',
    image: null,
    run: checkoutCommand(job),
    uses: null,
    env: {},
    secrets: [],
    locked: true,
    origin: 'template',
    junit: null,
    artifacts: [],
  };
  const { exitCode } = await executor.run(step, {
    workspace,
    env: { GIT_TERMINAL_PROMPT: '0' },
    onLine: line,
    label: `${job.jobId.slice(0, 8)}-checkout`,
  });
  return { ok: exitCode === 0, exitCode };
}
