import type { CodeCheckState, CodeLinkState, CodeReviewState } from '@bemmoly/shared';
import { z } from 'zod';
import { readPayload } from '../signature.ts';
import { firstLine, type ActivityDraft, type ParsedDelivery } from '../types.ts';

/*
 * GitLab's webhook payloads, read loosely, and turned into host-neutral activities. Nothing
 * outside the GitLab files sees these shapes.
 */

const text = z.string().nullish();
const projectSchema = z.object({ path_with_namespace: z.string(), web_url: z.string() });

/** A merge request as the API lists it; the webhook's object_attributes carry the same fields. */
export const gitlabRequestSchema = z.object({
  iid: z.number().int(),
  title: z.string(),
  description: text,
  state: z.string(),
  draft: z.boolean().nullish(),
  work_in_progress: z.boolean().nullish(),
  url: text,
  web_url: text,
  source_branch: z.string(),
  updated_at: z.string(),
  author: z.object({ username: z.string() }).nullish(),
});
export type GitlabRequest = z.infer<typeof gitlabRequestSchema>;

const requestEvent = z.object({
  user: z.object({ username: z.string() }).nullish(),
  project: projectSchema,
  object_attributes: gitlabRequestSchema.extend({ action: text }),
});

const pushEvent = z.object({
  ref: z.string(),
  after: z.string(),
  project: projectSchema,
  commits: z
    .array(
      z.object({
        id: z.string(),
        message: z.string(),
        url: z.string(),
        timestamp: z.string(),
        author: z.object({ name: z.string().nullish() }).nullish(),
      }),
    )
    .default([]),
});

const pipelineEvent = z.object({
  project: projectSchema,
  object_attributes: z.object({ status: z.string(), finished_at: text, created_at: text }),
  merge_request: z.object({ iid: z.number().int() }).nullish(),
});

const DELETED = /^0+$/;
const BRANCH_PREFIX = 'refs/heads/';
const MAX_COMMITS = 20;

/** GitLab writes "2026-10-01 10:00:00 UTC" in older hooks and ISO in newer ones. */
export function gitlabTime(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const parsed = Date.parse(value.replace(' UTC', 'Z').replace(/^(\S+) (\S+)/, '$1T$2'));
  const direct = Date.parse(value);
  const time = Number.isNaN(direct) ? parsed : direct;
  return Number.isNaN(time) ? fallback : new Date(time).toISOString();
}

function requestState(request: GitlabRequest): CodeLinkState {
  if (request.state === 'merged') return 'merged';
  if (request.state === 'closed' || request.state === 'locked') return 'closed';
  return request.draft || request.work_in_progress ? 'draft' : 'open';
}

export function requestActivity(
  repository: string,
  request: GitlabRequest,
  now: string,
  review: CodeReviewState | null = null,
): ActivityDraft {
  return {
    repository,
    kind: 'pull_request',
    externalId: String(request.iid),
    ref: `!${request.iid}`,
    title: request.title,
    url: request.web_url ?? request.url ?? '',
    state: requestState(request),
    checks: null,
    review,
    author: request.author?.username ?? null,
    texts: [request.source_branch, request.title, request.description ?? ''],
    occurredAt: gitlabTime(request.updated_at, now),
    mode: 'link',
  };
}

const REVIEWS: Record<string, CodeReviewState> = {
  approved: 'approved',
  approval: 'approved',
  unapproved: 'review_required',
  unapproval: 'review_required',
};

function pipelineChecks(status: string): CodeCheckState {
  if (status === 'success' || status === 'skipped') return 'passing';
  if (status === 'failed' || status === 'canceled') return 'failing';
  return 'pending';
}

function branchActivity(
  project: z.infer<typeof projectSchema>,
  branch: string,
  occurredAt: string,
  mode: ActivityDraft['mode'],
): ActivityDraft {
  return {
    repository: project.path_with_namespace,
    kind: 'branch',
    externalId: branch,
    ref: branch,
    title: branch,
    url: `${project.web_url}/-/tree/${branch.split('/').map(encodeURIComponent).join('/')}`,
    state: null,
    checks: null,
    review: null,
    author: null,
    texts: [branch],
    occurredAt,
    mode,
  };
}

function parsePush(event: string, body: Buffer, now: string): ParsedDelivery {
  const push = readPayload(body, pushEvent, 'GitLab push');
  const repo = push.project.path_with_namespace;
  if (!push.ref.startsWith(BRANCH_PREFIX)) {
    return { event, action: null, summary: `Tag pushed to ${repo}`, activities: [] };
  }
  const branch = push.ref.slice(BRANCH_PREFIX.length);
  if (DELETED.test(push.after)) {
    return {
      event,
      action: 'deleted',
      summary: `Branch ${branch} deleted in ${repo}`,
      activities: [branchActivity(push.project, branch, now, 'remove')],
    };
  }
  const commits = push.commits.slice(-MAX_COMMITS).map((commit): ActivityDraft => ({
    repository: repo,
    kind: 'commit',
    externalId: commit.id,
    ref: commit.id.slice(0, 8),
    title: firstLine(commit.message),
    url: commit.url,
    state: null,
    checks: null,
    review: null,
    author: commit.author?.name ?? null,
    texts: [commit.message],
    occurredAt: gitlabTime(commit.timestamp, now),
    mode: 'link',
  }));
  const count = push.commits.length;
  return {
    event,
    action: null,
    summary: `${count} ${count === 1 ? 'commit' : 'commits'} pushed to ${branch} in ${repo}`,
    activities: [branchActivity(push.project, branch, now, 'link'), ...commits],
  };
}

/** One verified GitLab delivery as activities; hooks Bemmoly does not use are ignored. */
export function parseGitlabEvent(event: string, body: Buffer, now: string): ParsedDelivery {
  if (event === 'Merge Request Hook') {
    const payload = readPayload(body, requestEvent, 'GitLab merge request');
    const request = payload.object_attributes;
    const action = request.action ?? null;
    const repo = payload.project.path_with_namespace;
    return {
      event,
      action,
      summary: `Merge request !${request.iid} ${action ?? 'changed'} in ${repo}`,
      activities: [requestActivity(repo, request, now, REVIEWS[action ?? ''] ?? null)],
    };
  }
  if (event === 'Push Hook') return parsePush(event, body, now);
  if (event === 'Pipeline Hook') {
    const payload = readPayload(body, pipelineEvent, 'GitLab pipeline');
    const checks = pipelineChecks(payload.object_attributes.status);
    const repo = payload.project.path_with_namespace;
    const request = payload.merge_request;
    const at = gitlabTime(
      payload.object_attributes.finished_at ?? payload.object_attributes.created_at,
      now,
    );
    return {
      event,
      action: payload.object_attributes.status,
      summary: `Pipeline ${checks} in ${repo}`,
      activities: request
        ? [
            {
              repository: repo,
              kind: 'pull_request',
              externalId: String(request.iid),
              ref: `!${request.iid}`,
              title: '',
              url: '',
              state: null,
              checks,
              review: null,
              author: null,
              texts: [],
              occurredAt: at,
              mode: 'update',
            },
          ]
        : [],
    };
  }
  return { event, action: null, summary: `${event} is not used by Bemmoly`, activities: [] };
}
