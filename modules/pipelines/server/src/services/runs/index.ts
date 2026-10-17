import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError, ValidationError } from '@bemmoly/shared';
import type { ResolvedPipeline } from '../../../../shared/pipeline-spec.ts';
import type {
  CancelRunBody,
  CreateRunBody,
  ListRunsQuery,
  RerunBody,
  RunDetail,
  RunGraph,
  RunsPage,
} from '../../../../shared/runs.ts';
import { createRunBodySchema, rerunBodySchema } from '../../../../shared/runs.ts';
import {
  authorizePipelines,
  personOf,
  requireAccess,
  requireDatabase,
  requirePerson,
} from '../deps.ts';
import { advanceRun, type RunOutcome } from '../orchestrator/advance.ts';
import { cancelJobsOf } from './cancel.ts';
import { announce, runDefaults, type ExecutionDeps } from './context.ts';
import { applicationPipeline } from './pipeline-info.ts';
import { listRuns, readGraph, readRun } from './reads.ts';
import { resetForRerun } from './rerun.ts';
import { startRun, type StartApplication } from './start.ts';

export { createRunHooks, type RunHooks } from './hooks.ts';
export { startRun, type StartRunInput, type StartedRun } from './start.ts';

/*
 * Runs under /api/v1/pipelines/runs: start one by hand, read, cancel, re-run. Starting,
 * cancelling and re-running need `run` on every application the run covers (the access
 * engine: bindings, owning team, policies); reading needs Pipelines.
 */

interface ApplicationRow {
  id: string;
  key: string;
  owner_team_id: string | null;
  pipeline: unknown;
  repository_id: string | null;
  default_branch: string | null;
}

async function applicationByKey(sql: SqlExecutor, key: string): Promise<ApplicationRow> {
  const [row] = await sql<ApplicationRow[]>`
    select a.id, a.key, a.owner_team_id, a.pipeline, a.repository_id, p.default_branch
    from pipeline_applications a left join pipeline_repositories p on p.id = a.repository_id
    where a.key = ${key} and a.archived_at is null`;
  if (!row) throw new NotFoundError(`There is no application called ${key}`);
  return row;
}

async function commitFor(sql: SqlExecutor, application: ApplicationRow, ref: string) {
  const [latest] = await sql<{ commit_sha: string }[]>`
    select r.commit_sha from pipeline_runs r
    where r.application_id = ${application.id} and r.ref = ${ref}
    order by r.id desc limit 1`;
  if (latest) return latest.commit_sha;
  throw new ValidationError(
    `Pipelines has not seen a commit on ${ref} for ${application.key} yet. Give the commit to run.`,
  );
}

export function createRunsService(deps: ExecutionDeps) {
  const access = () => requireAccess(deps);

  async function authorizeRun(ctx: RequestContext, sql: SqlExecutor, runId: string) {
    const apps = await sql<{ key: string }[]>`
      select a.key from pipeline_run_applications ra
      join pipeline_applications a on a.id = ra.application_id where ra.run_id = ${runId}`;
    if (apps.length === 0) await authorizePipelines(ctx, 'pipelines.run');
    for (const app of apps) await access().authorizeAction(ctx, 'run', { application: app.key });
  }

  return {
    async list(ctx: RequestContext, query: ListRunsQuery): Promise<RunsPage> {
      await authorizePipelines(ctx);
      return listRuns(requireDatabase(deps), query, personOf(ctx.actor));
    },

    async get(ctx: RequestContext, runId: string): Promise<RunDetail> {
      await authorizePipelines(ctx);
      return readRun(requireDatabase(deps), runId);
    },

    async graph(ctx: RequestContext, runId: string): Promise<RunGraph> {
      await authorizePipelines(ctx);
      return readGraph(requireDatabase(deps), runId);
    },

    async pipeline(ctx: RequestContext, key: string) {
      await authorizePipelines(ctx);
      return applicationPipeline(requireDatabase(deps), key);
    },

    /** "Run pipeline…": a person runs an application's pipeline at a ref, with inputs. */
    async create(ctx: RequestContext, input: CreateRunBody): Promise<RunDetail> {
      const body = createRunBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const person = requirePerson(ctx.actor);
      await access().authorizeAction(ctx, 'run', { application: body.application });
      const application = await applicationByKey(sql, body.application);
      const commitSha = body.commitSha ?? (await commitFor(sql, application, body.ref));
      const defaults = await runDefaults(deps);
      const started = await sql.begin((tx) =>
        startRun(tx, {
          applications: [
            {
              id: application.id,
              key: application.key,
              teamId: application.owner_team_id,
              pipeline: application.pipeline,
            },
          ],
          repositoryId: application.repository_id,
          trigger: 'manual',
          ref: body.ref,
          commitSha,
          title: `Run pipeline on ${body.ref}`,
          authorUserId: person,
          createdBy: person,
          priorityClass: 'main',
          inputs: body.inputs,
          variables: body.variables,
          ...defaults,
        }),
      );
      return readRun(sql, started.id);
    },

    async cancel(ctx: RequestContext, runId: string, body: CancelRunBody): Promise<RunDetail> {
      const sql = requireDatabase(deps);
      await authorizeRun(ctx, sql, runId);
      requirePerson(ctx.actor);
      const outcome = await sql.begin(async (tx) => {
        const [run] = await tx<{ id: string }[]>`
          update pipeline_runs set
            cancel_reason = ${body.reason ?? 'Cancelled by a person'}, updated_at = now()
          where id = ${runId} returning id`;
        if (!run) throw new NotFoundError('That run does not exist');
        await cancelJobsOf(tx, runId, { reason: body.reason ?? 'Cancelled' });
        return advanceRun(tx, runId);
      });
      await announce(deps, [outcome]);
      return readRun(sql, runId);
    },

    /**
     * Shift+R re-runs only what did not pass, in the same run, keeping the passing work.
     * "all" starts a new run of exactly the pipeline the old one ran.
     */
    async rerun(ctx: RequestContext, runId: string, input: RerunBody): Promise<RunDetail> {
      const body = rerunBodySchema.parse(input);
      const sql = requireDatabase(deps);
      await authorizeRun(ctx, sql, runId);
      const person = requirePerson(ctx.actor);
      if (body.only === 'failed') {
        const outcome: RunOutcome = await sql.begin((tx) => resetForRerun(tx, runId));
        await announce(deps, [outcome]);
        return readRun(sql, runId);
      }
      const defaults = await runDefaults(deps);
      const started = await sql.begin(async (tx) => {
        const [run] = await tx<
          {
            repository_id: string | null;
            ref: string;
            commit_sha: string;
            title: string;
            pull_request: number | null;
            priority_class: 'main';
            resolved_spec: unknown;
            inputs: Record<string, string>;
            variables: Record<string, string>;
            from_fork: boolean;
            failure_reason: string | null;
          }[]
        >`select * from pipeline_runs where id = ${runId}`;
        if (!run) throw new NotFoundError('That run does not exist');
        const apps = await tx<
          { id: string; key: string; owner_team_id: string | null; pipeline: unknown }[]
        >`
          select a.id, a.key, a.owner_team_id, a.pipeline from pipeline_run_applications ra
          join pipeline_applications a on a.id = ra.application_id
          where ra.run_id = ${runId} order by ra.created_at`;
        if (apps.length === 0 && run.failure_reason) {
          throw new ValidationError(
            'No application came from this push yet. Fix the file and push again.',
          );
        }
        const spec = run.resolved_spec as
          | ResolvedPipeline
          | { applications: Array<{ key: string; pipeline: ResolvedPipeline }> }
          | null;
        const resolvedFor = (key: string): ResolvedPipeline | undefined =>
          spec && 'applications' in spec
            ? spec.applications.find((entry) => entry.key === key)?.pipeline
            : (spec ?? undefined);
        const applications: StartApplication[] = apps.map((app) => ({
          id: app.id,
          key: app.key,
          teamId: app.owner_team_id,
          // A run that never resolved has nothing to repeat: it resolves today's pipeline.
          pipeline: app.pipeline,
          ...(resolvedFor(app.key) ? { resolved: resolvedFor(app.key) } : {}),
        }));
        return startRun(tx, {
          applications,
          repositoryId: run.repository_id,
          trigger: 'rerun',
          ref: run.ref,
          commitSha: run.commit_sha,
          title: run.title,
          pullRequest: run.pull_request,
          authorUserId: person,
          createdBy: person,
          priorityClass: run.priority_class,
          inputs: run.inputs,
          variables: run.variables,
          rerunOfRunId: runId,
          fromFork: run.from_fork,
          ...defaults,
        });
      });
      return readRun(sql, started.id);
    },
  };
}

export type RunsService = ReturnType<typeof createRunsService>;
