import type { CodeEvent, SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import { requireDatabase } from '../deps.ts';
import { advanceRun } from '../orchestrator/advance.ts';
import { affectedApplications } from '../orchestrator/affected.ts';
import { cancelJobsOf } from '../runs/cancel.ts';
import { announce, runDefaults, type ExecutionDeps } from '../runs/context.ts';
import { startRun, type StartRunInput } from '../runs/start.ts';
import { nextRunAt } from './schedules.ts';

export { nextRunAt, refreshSchedules } from './schedules.ts';

/*
 * What starts runs without a person (architecture §5, §7, §8): pushes, pull requests, merge
 * queues and schedules. Each is a plain function of one event, so the inbox (which calls
 * handlers in order per repository, at least once) wires them in one line, and each is
 * idempotent through the run's idempotency key: a redelivered event starts nothing new.
 * A newer commit on a pull request supersedes the older run; closing it cancels the run.
 */

type Push = Extract<CodeEvent, { type: 'push' }>;
type PullRequest = Extract<CodeEvent, { type: 'pull_request' }>;
type MergeGroup = Extract<CodeEvent, { type: 'merge_group' }>;

const PR_ACTIONS = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review']);

interface Candidate {
  id: string;
  key: string;
  owner_team_id: string | null;
  pipeline: unknown;
  path: string;
  paths: string[] | null;
  repository_id: string;
}

async function candidatesIn(sql: SqlExecutor, repository: string): Promise<Candidate[]> {
  return sql<Candidate[]>`
    select a.id, a.key, a.owner_team_id, a.pipeline, a.path, a.paths, a.repository_id
    from pipeline_applications a
    join pipeline_repositories p on p.id = a.repository_id
    where p.full_name = ${repository} and a.archived_at is null and a.pipeline is not null
    order by a.key`;
}

export function createTriggersService(deps: ExecutionDeps) {
  async function start(
    repository: string,
    changedFiles: readonly string[] | null,
    input: Omit<
      StartRunInput,
      'applications' | 'repositoryId' | 'defaultTimeoutMinutes' | 'defaultPoolKey'
    >,
  ): Promise<string | null> {
    const sql = requireDatabase(deps);
    const candidates = await candidatesIn(sql, repository);
    const affected = new Set(
      affectedApplications(
        candidates.map((c) => ({ key: c.key, path: c.path, paths: c.paths ?? [] })),
        changedFiles,
      ),
    );
    const applications = candidates.filter((c) => affected.has(c.key));
    const first = applications[0];
    if (!first) return null;
    const defaults = await runDefaults(deps);
    // A pipeline that does not resolve (a missing template, a bad input) must not hold the
    // repository's inbox: the event is done, and the run form says what is wrong when a
    // person tries.
    const run = await sql
      .begin((tx) =>
        startRun(tx, {
          ...input,
          ...defaults,
          repositoryId: first.repository_id,
          applications: applications.map((c) => ({
            id: c.id,
            key: c.key,
            teamId: c.owner_team_id,
            pipeline: c.pipeline,
          })),
        }),
      )
      .catch((error: unknown) => {
        if (error instanceof ValidationError) return null;
        throw error;
      });
    return run?.id ?? null;
  }

  return {
    async push(event: Push): Promise<string | null> {
      const { push } = event;
      if (push.deleted) return null;
      return start(event.repository, push.truncated ? null : push.changedFiles, {
        trigger: 'push',
        ref: push.branch,
        commitSha: push.after,
        title: `Push to ${push.branch}`,
        authorLogin: push.pusher,
        priorityClass: push.isDefaultBranch ? 'main' : 'pull_request',
        idempotencyKey: `push:${event.repository}:${push.branch}:${push.after}`,
        // Every default-branch commit builds; a newer push to any other branch replaces the last.
        supersedeKey: push.isDefaultBranch ? null : `branch:${event.repository}:${push.branch}`,
      });
    },

    async pullRequest(event: PullRequest): Promise<string | null> {
      const key = `pr:${event.repository}#${event.number}`;
      if (event.action === 'closed') {
        const sql = requireDatabase(deps);
        const outcomes = await sql.begin(async (tx) => {
          const live = await tx<{ id: string }[]>`
            select id from pipeline_runs
            where supersede_key = ${key} and state in ('queued', 'running', 'waiting')`;
          const done = [];
          for (const run of live) {
            await cancelJobsOf(tx, run.id, { reason: 'The pull request was closed' });
            done.push(await advanceRun(tx, run.id));
          }
          return done;
        });
        await announce(deps, outcomes);
        return null;
      }
      if (!PR_ACTIONS.has(event.action)) return null;
      // The host does not list a pull request's files; building every application is safe.
      return start(event.repository, null, {
        trigger: 'pull_request',
        ref: event.headRef,
        commitSha: event.headSha,
        title: event.title,
        pullRequest: event.number,
        authorLogin: event.author,
        priorityClass: 'pull_request',
        idempotencyKey: `${key}:${event.headSha}`,
        supersedeKey: key,
        fromFork: event.fromFork,
      });
    },

    async mergeGroup(event: MergeGroup): Promise<string | null> {
      if (event.action !== 'checks_requested') return null;
      return start(event.repository, null, {
        trigger: 'merge_group',
        ref: event.headRef,
        commitSha: event.headSha,
        title: `Merge queue into ${event.baseRef}`,
        priorityClass: 'main',
        idempotencyKey: `merge_group:${event.repository}:${event.headSha}`,
      });
    },

    /** Starts every schedule that is due; the minute job calls it on one replica at a time. */
    async runDueSchedules(now = new Date()): Promise<number> {
      const sql = requireDatabase(deps);
      const defaults = await runDefaults(deps);
      return sql.begin(async (tx) => {
        const due = await tx<
          {
            id: string;
            application_id: string;
            key: string;
            owner_team_id: string | null;
            pipeline: unknown;
            repository_id: string | null;
            default_branch: string | null;
            cron: string;
            time_zone: string;
            ref: string | null;
            inputs: Record<string, string | number | boolean>;
            next_run_at: Date | string;
          }[]
        >`
          select s.id, s.application_id, a.key, a.owner_team_id, a.pipeline, a.repository_id,
            p.default_branch, s.cron, s.time_zone, s.ref, s.inputs, s.next_run_at
          from pipeline_schedules s
          join pipeline_applications a on a.id = s.application_id and a.archived_at is null
          left join pipeline_repositories p on p.id = a.repository_id
          where s.next_run_at <= ${now.toISOString()}::timestamptz
          order by s.next_run_at limit 100
          for update of s skip locked`;
        let started = 0;
        for (const schedule of due) {
          const ref = schedule.ref ?? schedule.default_branch ?? 'main';
          const [latest] = await tx<{ commit_sha: string }[]>`
            select commit_sha from pipeline_runs
            where application_id = ${schedule.application_id} and ref = ${ref}
            order by id desc limit 1`;
          const slot = new Date(schedule.next_run_at).toISOString();
          if (latest) {
            await startRun(tx, {
              applications: [
                {
                  id: schedule.application_id,
                  key: schedule.key,
                  teamId: schedule.owner_team_id,
                  pipeline: schedule.pipeline,
                },
              ],
              repositoryId: schedule.repository_id,
              trigger: 'schedule',
              ref,
              commitSha: latest.commit_sha,
              title: `Scheduled run (${schedule.cron}, ${schedule.time_zone})`,
              priorityClass: 'scheduled',
              idempotencyKey: `schedule:${schedule.id}:${slot}`,
              inputs: schedule.inputs,
              ...defaults,
            });
            started += 1;
          }
          const next = nextRunAt(schedule.cron, schedule.time_zone, now);
          await tx`
            update pipeline_schedules set last_run_at = ${slot}::timestamptz,
              next_run_at = ${next?.toISOString() ?? null}::timestamptz, updated_at = now()
            where id = ${schedule.id}`;
        }
        return started;
      });
    },
  };
}

export type TriggersService = ReturnType<typeof createTriggersService>;
