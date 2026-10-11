import type { CodeCheckState, CodeLinkState, CodeReviewState } from '@bemmoly/shared';
import { z } from 'zod';
import { readPayload } from '../signature.ts';
import { firstLine, type ActivityDraft, type ParsedDelivery } from '../types.ts';

/*
 * GitHub's webhook payloads, read loosely (only the fields Bemmoly uses), and turned into
 * host-neutral activities. Nothing outside the GitHub files sees these shapes.
 */

const text = z.string().nullish();
const repositorySchema = z.object({ full_name: z.string(), html_url: z.string() });

export const githubPullSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: text,
  html_url: z.string(),
  state: z.string(),
  draft: z.boolean().nullish(),
  merged: z.boolean().nullish(),
  merged_at: text,
  updated_at: z.string(),
  user: z.object({ login: z.string() }).nullish(),
  head: z.object({ ref: z.string() }),
});
type GithubPull = z.infer<typeof githubPullSchema>;

const pullEvent = z.object({
  action: z.string(),
  repository: repositorySchema,
  pull_request: githubPullSchema,
  review: z.object({ state: z.string() }).nullish(),
});

const commitSchema = z.object({
  id: z.string(),
  message: z.string(),
  url: z.string(),
  timestamp: z.string(),
  author: z.object({ name: z.string().nullish(), username: z.string().nullish() }).nullish(),
});

const pushEvent = z.object({
  ref: z.string(),
  deleted: z.boolean().default(false),
  repository: repositorySchema,
  commits: z.array(commitSchema).default([]),
  head_commit: commitSchema.nullish(),
});

const refEvent = z.object({ ref: z.string(), ref_type: z.string(), repository: repositorySchema });

const checkSuiteEvent = z.object({
  action: z.string(),
  repository: repositorySchema,
  check_suite: z.object({
    status: z.string().nullish(),
    conclusion: text,
    updated_at: z.string(),
    pull_requests: z.array(z.object({ number: z.number().int() })).default([]),
  }),
});

/** A push names at most this many commits for linking; GitHub itself sends at most 20. */
const MAX_COMMITS = 20;

export function pullState(pull: Pick<GithubPull, 'state' | 'draft' | 'merged' | 'merged_at'>) {
  if (pull.merged || pull.merged_at) return 'merged' satisfies CodeLinkState;
  if (pull.state === 'closed') return 'closed' satisfies CodeLinkState;
  return (pull.draft ? 'draft' : 'open') satisfies CodeLinkState;
}

const REVIEWS: Record<string, CodeReviewState> = {
  approved: 'approved',
  changes_requested: 'changes_requested',
  dismissed: 'review_required',
};

export function pullActivity(
  repository: string,
  pull: GithubPull,
  review: CodeReviewState | null = null,
): ActivityDraft {
  return {
    repository,
    kind: 'pull_request',
    externalId: String(pull.number),
    ref: `#${pull.number}`,
    title: pull.title,
    url: pull.html_url,
    state: pullState(pull),
    checks: null,
    review,
    author: pull.user?.login ?? null,
    texts: [pull.head.ref, pull.title, pull.body ?? ''],
    occurredAt: pull.updated_at,
    mode: 'link',
  };
}

function branchActivity(
  repository: { full_name: string; html_url: string },
  branch: string,
  occurredAt: string,
  mode: ActivityDraft['mode'],
): ActivityDraft {
  return {
    repository: repository.full_name,
    kind: 'branch',
    externalId: branch,
    ref: branch,
    title: branch,
    url: `${repository.html_url}/tree/${branch.split('/').map(encodeURIComponent).join('/')}`,
    state: null,
    checks: null,
    review: null,
    author: null,
    texts: [branch],
    occurredAt,
    mode,
  };
}

function checksOf(status: string | null | undefined, conclusion: string | null | undefined) {
  if (status !== 'completed') return 'pending' satisfies CodeCheckState;
  return (
    ['success', 'neutral', 'skipped'].includes(conclusion ?? '') ? 'passing' : 'failing'
  ) satisfies CodeCheckState;
}

const BRANCH_PREFIX = 'refs/heads/';

function parsePush(body: Buffer, now: string): ParsedDelivery {
  const push = readPayload(body, pushEvent, 'GitHub push');
  const repo = push.repository;
  if (!push.ref.startsWith(BRANCH_PREFIX)) {
    return {
      event: 'push',
      action: null,
      summary: `Tag pushed to ${repo.full_name}`,
      activities: [],
    };
  }
  const branch = push.ref.slice(BRANCH_PREFIX.length);
  const at = push.head_commit?.timestamp ?? now;
  if (push.deleted) {
    return {
      event: 'push',
      action: 'deleted',
      summary: `Branch ${branch} deleted in ${repo.full_name}`,
      activities: [branchActivity(repo, branch, at, 'remove')],
    };
  }
  const commits = push.commits.slice(-MAX_COMMITS).map((commit): ActivityDraft => ({
    repository: repo.full_name,
    kind: 'commit',
    externalId: commit.id,
    ref: commit.id.slice(0, 7),
    title: firstLine(commit.message),
    url: commit.url,
    state: null,
    checks: null,
    review: null,
    author: commit.author?.username ?? commit.author?.name ?? null,
    texts: [commit.message],
    occurredAt: commit.timestamp,
    mode: 'link',
  }));
  const count = push.commits.length;
  return {
    event: 'push',
    action: null,
    summary: `${count} ${count === 1 ? 'commit' : 'commits'} pushed to ${branch} in ${repo.full_name}`,
    activities: [branchActivity(repo, branch, at, 'link'), ...commits],
  };
}

/** One verified GitHub delivery as activities; events Bemmoly does not use are ignored. */
export function parseGithubEvent(event: string, body: Buffer, now: string): ParsedDelivery {
  if (event === 'pull_request' || event === 'pull_request_review') {
    const payload = readPayload(body, pullEvent, 'GitHub pull request');
    const { pull_request: pull, repository } = payload;
    const review =
      event === 'pull_request_review'
        ? (REVIEWS[payload.action === 'dismissed' ? 'dismissed' : (payload.review?.state ?? '')] ??
          null)
        : payload.action === 'review_requested'
          ? 'review_required'
          : null;
    const verb = event === 'pull_request_review' ? `reviewed (${payload.action})` : payload.action;
    return {
      event,
      action: payload.action,
      summary: `Pull request #${pull.number} ${verb.replaceAll('_', ' ')} in ${repository.full_name}`,
      activities: [pullActivity(repository.full_name, pull, review)],
    };
  }
  if (event === 'push') return parsePush(body, now);
  if (event === 'create' || event === 'delete') {
    const payload = readPayload(body, refEvent, `GitHub ${event}`);
    if (payload.ref_type !== 'branch') {
      return {
        event,
        action: payload.ref_type,
        summary: `A ${payload.ref_type} changed`,
        activities: [],
      };
    }
    const mode = event === 'create' ? 'link' : 'remove';
    return {
      event,
      action: 'branch',
      summary: `Branch ${payload.ref} ${event === 'create' ? 'created' : 'deleted'} in ${payload.repository.full_name}`,
      activities: [branchActivity(payload.repository, payload.ref, now, mode)],
    };
  }
  if (event === 'check_suite') {
    const payload = readPayload(body, checkSuiteEvent, 'GitHub check suite');
    const suite = payload.check_suite;
    const checks = checksOf(suite.status, suite.conclusion);
    return {
      event,
      action: payload.action,
      summary: `Checks ${checks} in ${payload.repository.full_name}`,
      activities: suite.pull_requests.map((pull) => ({
        repository: payload.repository.full_name,
        kind: 'pull_request',
        externalId: String(pull.number),
        ref: `#${pull.number}`,
        title: '',
        url: '',
        state: null,
        checks,
        review: null,
        author: null,
        texts: [],
        occurredAt: suite.updated_at,
        mode: 'update',
      })),
    };
  }
  return { event, action: null, summary: `${event} is not used by Bemmoly`, activities: [] };
}
