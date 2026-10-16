import { z } from 'zod';
import type { CodeEvent, CodePush } from '../../../contracts/code-hosts.ts';
import { readPayload } from '../signature.ts';

/*
 * GitHub deliveries as host-neutral events, for modules that act on them rather than link
 * them: start work on a push or a pull request, read checks and workflow runs, re-scan a
 * repository when it is created or renamed. Read loosely: only the fields used, so a
 * payload GitHub extends still reads.
 */

const text = z.string().nullish();
const repo = z.object({
  full_name: z.string(),
  default_branch: text,
});

const pushSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  created: z.boolean().default(false),
  deleted: z.boolean().default(false),
  forced: z.boolean().default(false),
  repository: repo,
  pusher: z.object({ name: text }).nullish(),
  commits: z
    .array(
      z.object({
        added: z.array(z.string()).default([]),
        modified: z.array(z.string()).default([]),
        removed: z.array(z.string()).default([]),
        timestamp: text,
      }),
    )
    .default([]),
  head_commit: z.object({ timestamp: text }).nullish(),
});

const pullSchema = z.object({
  action: z.string(),
  repository: repo,
  pull_request: z.object({
    number: z.number().int(),
    title: z.string(),
    html_url: z.string(),
    draft: z.boolean().nullish(),
    merged: z.boolean().nullish(),
    updated_at: z.string(),
    user: z.object({ login: z.string() }).nullish(),
    head: z.object({
      sha: z.string(),
      ref: z.string(),
      repo: z.object({ full_name: z.string() }).nullish(),
    }),
    base: z.object({ ref: z.string() }),
  }),
});

const mergeGroupSchema = z.object({
  action: z.string(),
  repository: repo,
  merge_group: z.object({ head_sha: z.string(), head_ref: z.string(), base_ref: z.string() }),
});

const statusSchema = z.enum(['queued', 'in_progress', 'completed']).catch('in_progress');

const checkRunSchema = z.object({
  repository: repo,
  check_run: z.object({
    name: z.string(),
    head_sha: z.string(),
    status: statusSchema,
    conclusion: text,
    html_url: text,
    completed_at: text,
    started_at: text,
    app: z.object({ slug: text }).nullish(),
  }),
});

const workflowRunSchema = z.object({
  repository: repo,
  workflow_run: z.object({
    id: z.number(),
    name: text,
    path: z.string(),
    head_sha: z.string(),
    head_branch: text,
    event: z.string(),
    status: statusSchema,
    conclusion: text,
    html_url: text,
    updated_at: z.string(),
  }),
});

const repositorySchema = z.object({
  action: z.string(),
  repository: repo,
  changes: z
    .object({ repository: z.object({ name: z.object({ from: z.string() }) }) })
    .partial()
    .nullish(),
});

const installationReposSchema = z.object({
  action: z.string(),
  repositories_added: z.array(z.object({ full_name: z.string() })).default([]),
  repositories_removed: z.array(z.object({ full_name: z.string() })).default([]),
});

/** GitHub sends at most 20 commits with a push; past that the file list is incomplete. */
const PUSH_COMMIT_LIMIT = 20;
const BRANCH_PREFIX = 'refs/heads/';

export function pushDetail(body: Buffer): CodePush | null {
  const push = readPayload(body, pushSchema, 'GitHub push');
  if (!push.ref.startsWith(BRANCH_PREFIX)) return null;
  const branch = push.ref.slice(BRANCH_PREFIX.length);
  const files = new Set<string>();
  for (const commit of push.commits) {
    for (const path of [...commit.added, ...commit.modified, ...commit.removed]) files.add(path);
  }
  const defaultBranch = push.repository.default_branch ?? null;
  return {
    branch,
    before: push.before,
    after: push.after,
    defaultBranch,
    isDefaultBranch: defaultBranch === branch,
    created: push.created,
    deleted: push.deleted,
    forced: push.forced,
    changedFiles: [...files].sort(),
    truncated: push.commits.length >= PUSH_COMMIT_LIMIT,
    commits: push.commits.length,
    pusher: push.pusher?.name ?? null,
  };
}

/** The events one delivery carries; empty for events no module acts on. */
export function parseGithubEvents(event: string, body: Buffer, now: string): CodeEvent[] {
  switch (event) {
    case 'push': {
      const push = pushDetail(body);
      if (!push) return [];
      const repository = readPayload(body, pushSchema, 'GitHub push').repository.full_name;
      return [{ type: 'push', repository, push, occurredAt: now }];
    }
    case 'pull_request': {
      const {
        action,
        repository,
        pull_request: pull,
      } = readPayload(body, pullSchema, 'GitHub pull request');
      return [
        {
          type: 'pull_request',
          repository: repository.full_name,
          action,
          number: pull.number,
          title: pull.title,
          url: pull.html_url,
          headSha: pull.head.sha,
          headRef: pull.head.ref,
          baseRef: pull.base.ref,
          fromFork: (pull.head.repo?.full_name ?? repository.full_name) !== repository.full_name,
          draft: pull.draft ?? false,
          merged: pull.merged ?? false,
          author: pull.user?.login ?? null,
          occurredAt: pull.updated_at,
        },
      ];
    }
    case 'merge_group': {
      const payload = readPayload(body, mergeGroupSchema, 'GitHub merge group');
      const group = payload.merge_group;
      return [
        {
          type: 'merge_group',
          repository: payload.repository.full_name,
          action: payload.action,
          headSha: group.head_sha,
          headRef: group.head_ref,
          baseRef: group.base_ref,
          occurredAt: now,
        },
      ];
    }
    case 'check_run': {
      const { repository, check_run: run } = readPayload(body, checkRunSchema, 'GitHub check run');
      return [
        {
          type: 'check_run',
          repository: repository.full_name,
          name: run.name,
          headSha: run.head_sha,
          status: run.status,
          conclusion: run.conclusion ?? null,
          url: run.html_url ?? null,
          app: run.app?.slug ?? null,
          occurredAt: run.completed_at ?? run.started_at ?? now,
        },
      ];
    }
    case 'workflow_run': {
      const { repository, workflow_run: run } = readPayload(
        body,
        workflowRunSchema,
        'GitHub workflow run',
      );
      return [
        {
          type: 'workflow_run',
          repository: repository.full_name,
          runId: String(run.id),
          name: run.name ?? run.path,
          path: run.path,
          headSha: run.head_sha,
          headBranch: run.head_branch ?? null,
          event: run.event,
          status: run.status,
          conclusion: run.conclusion ?? null,
          url: run.html_url ?? null,
          occurredAt: run.updated_at,
        },
      ];
    }
    case 'repository': {
      const payload = readPayload(body, repositorySchema, 'GitHub repository');
      return [
        {
          type: 'repository',
          repository: payload.repository.full_name,
          action: payload.action,
          previousName: payload.changes?.repository?.name?.from ?? null,
          defaultBranch: payload.repository.default_branch ?? null,
          occurredAt: now,
        },
      ];
    }
    case 'installation_repositories': {
      const payload = readPayload(body, installationReposSchema, 'GitHub installation');
      const event = (repository: string, action: string): CodeEvent => ({
        type: 'repository',
        repository,
        action,
        previousName: null,
        defaultBranch: null,
        occurredAt: now,
      });
      return [
        ...payload.repositories_added.map((r) => event(r.full_name, 'added')),
        ...payload.repositories_removed.map((r) => event(r.full_name, 'removed')),
      ];
    }
    default:
      return [];
  }
}
