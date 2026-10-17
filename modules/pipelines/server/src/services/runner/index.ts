import type { ModuleObjects } from '@bemmoly/core';
import { UnauthenticatedError } from '@bemmoly/shared';
import type {
  ClaimBody,
  ClaimedJob,
  HeartbeatBody,
  HeartbeatResponse,
  JobStateBody,
  LogChunkUpload,
  RegisterRunnerBody,
  RegisterRunnerResponse,
  SplitsBody,
  SplitsResponse,
  StepStateBody,
  TestReportUpload,
} from '../../../../shared/runner.ts';
import {
  claimBodySchema,
  heartbeatBodySchema,
  HEARTBEAT_SECONDS,
  registerRunnerBodySchema,
} from '../../../../shared/runner.ts';
import { topicOf } from '../../../../shared/streams.ts';
import { requireDatabase } from '../deps.ts';
import { claimNextJob } from '../dispatcher/claim.ts';
import { sweepJobs } from '../dispatcher/sweep.ts';
import type { DispatchWakeups } from '../dispatcher/wakeup.ts';
import { maskedReport } from '../../../../shared/secret-forms.ts';
import { createMasker, type LogsService } from '../logs/index.ts';
import { announce, queueCheck, type ExecutionDeps } from '../runs/context.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import { ingestReport, type TestsService } from '../tests/index.ts';
import { hashToken, newToken } from '../../utils/tokens.ts';
import { jobFromToken, LIVE_JOB, runnerFromToken } from './auth.ts';
import { finishJob, type FinishInput } from './finish.ts';
import { claimedJobPayload } from './payload.ts';
import { secretNames, secretsForRunner, type SecretResolver } from './secrets.ts';
import { uploadArtifact } from './artifacts.ts';

export { variableSecrets, type SecretResolver } from './secrets.ts';

/*
 * The runner protocol's server side (architecture §6). Every call authenticates with a
 * runner or job token, never a person; the claim is a long poll that answers as soon as a
 * job is ready in the runner's pool. Sweeps for lost runners piggyback on claims, so a
 * replica with runners attached keeps the queue honest without a separate timer.
 */

export interface RunnerDeps extends ExecutionDeps {
  wakeups: DispatchWakeups;
  logs: LogsService;
  tests: TestsService;
  secrets: SecretResolver;
  objects?: Pick<ModuleObjects, 'put'>;
}

/** Sweeping more often than heartbeats arrive finds nothing new. */
const SWEEP_EVERY_MS = HEARTBEAT_SECONDS * 1000;

export function createRunnerService(deps: RunnerDeps) {
  let lastSweep = 0;
  const masks = new Map<string, string[]>();

  async function maybeSweep() {
    if (Date.now() - lastSweep < SWEEP_EVERY_MS) return;
    lastSweep = Date.now();
    const result = await sweepJobs(requireDatabase(deps));
    await announce(deps, result.outcomes);
  }

  async function secretValues(job: { id: string; run_id: string; application_id: string | null }) {
    const cached = masks.get(job.id);
    if (cached) return cached;
    const sql = requireDatabase(deps);
    const { names } = await secretNames(sql, job.id);
    const values = Object.values(await deps.secrets.resolve(sql, job, names));
    if (masks.size > 500) masks.clear();
    masks.set(job.id, values);
    return values;
  }

  return {
    async register(input: RegisterRunnerBody): Promise<RegisterRunnerResponse> {
      const body = registerRunnerBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const [pool] = await sql<{ id: string; key: string }[]>`
        select id, key from pipeline_runner_pools where token_hash = ${hashToken(body.poolToken)}`;
      if (!pool)
        throw new UnauthenticatedError('That pool token is not valid; copy it again from Capacity');
      const runnerToken = newToken('runner');
      const [runner] = await sql<{ id: string }[]>`
        insert into pipeline_runners (pool_id, name, version, labels, state, last_heartbeat_at,
          token_hash)
        values (${pool.id}, ${body.name}, ${body.version}, ${body.labels}::text[], 'idle', now(),
          ${hashToken(runnerToken)})
        returning id`;
      if (!runner) throw new UnauthenticatedError('The runner could not be registered');
      return { runnerId: runner.id, runnerToken, pool, heartbeatSeconds: HEARTBEAT_SECONDS };
    },

    async heartbeat(token: string | undefined, input: HeartbeatBody): Promise<HeartbeatResponse> {
      const body = heartbeatBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const runner = await runnerFromToken(sql, token);
      await sql`
        update pipeline_runners set last_heartbeat_at = now(), updated_at = now(),
          state = case when state = 'draining' then state else ${body.state} end,
          current_job_id = ${body.jobId}::uuid
        where id = ${runner.id}`;
      let cancel = false;
      if (body.jobId) {
        const alive = await sql`
          update pipeline_jobs set heartbeat_at = now()
          where id = ${body.jobId} and runner_id = ${runner.id} and state in ('claimed', 'running')
          returning id`;
        cancel = alive.length === 0;
      }
      await maybeSweep();
      return { cancel, drain: runner.state === 'draining' };
    },

    /** Long poll: a job as soon as one is ready for this pool, or null when the wait ends. */
    async claim(
      token: string | undefined,
      input: ClaimBody,
      signal?: AbortSignal,
    ): Promise<ClaimedJob | null> {
      const body = claimBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const runner = await runnerFromToken(sql, token);
      if (runner.state === 'draining') return null;
      const deadline = Date.now() + body.waitSeconds * 1000;
      for (;;) {
        await maybeSweep();
        const jobToken = newToken('job');
        const claimed = await claimNextJob(sql, {
          poolId: runner.pool_id,
          runnerId: runner.id,
          tokenHash: hashToken(jobToken),
        });
        if (claimed) return claimedJobPayload(sql, claimed.id, jobToken);
        const left = deadline - Date.now();
        if (left <= 0 || signal?.aborted) return null;
        await deps.wakeups.wait(runner.pool_id, Math.min(left, SWEEP_EVERY_MS), signal);
      }
    },

    async jobState(jobId: string, token: string | undefined, body: JobStateBody): Promise<void> {
      if (body.state !== 'running') {
        await this.finish(jobId, token, {
          state: body.state,
          failureSummary: body.failureSummary,
          at: body.at,
        });
        return;
      }
      const sql = requireDatabase(deps);
      const job = await jobFromToken(sql, jobId, token);
      if (!LIVE_JOB.includes(job.state)) return;
      await sql.begin(async (tx) => {
        await tx`
          update pipeline_jobs set state = 'running', started_at = coalesce(started_at, now()),
            heartbeat_at = now(), updated_at = now()
          where id = ${jobId}`;
        await tx`
          update pipeline_runs set state = 'running', started_at = coalesce(started_at, now()),
            updated_at = now()
          where id = ${job.run_id} and state = 'queued'`;
        await publishStreamEvent(tx, {
          topic: topicOf.run(job.run_id),
          kind: 'job.updated',
          data: { id: jobId, runId: job.run_id, state: 'running' },
        });
        await publishStreamEvent(tx, {
          topic: topicOf.run(job.run_id),
          kind: 'run.updated',
          data: { id: job.run_id, state: 'running' },
        });
      });
      await queueCheck(deps, job, 'running');
    },

    async stepState(
      jobId: string,
      position: number,
      token: string | undefined,
      body: StepStateBody,
    ) {
      const sql = requireDatabase(deps);
      const job = await jobFromToken(sql, jobId, token);
      const done = body.state !== 'running';
      await sql.begin(async (tx) => {
        await tx`
          update pipeline_steps set state = ${body.state}, exit_code = ${body.exitCode ?? null},
            first_line = coalesce(${body.firstLine ?? null}, first_line),
            started_at = case when ${!done} then coalesce(started_at, ${body.at}::timestamptz)
              else started_at end,
            finished_at = case when ${done} then ${body.at}::timestamptz else finished_at end,
            line_count = case when ${done} then (
              select max(c.first_line + c.line_count) - coalesce(pipeline_steps.first_line, 1)
              from pipeline_log_chunks c where c.job_id = ${jobId}
                and c.step_id = pipeline_steps.id) else line_count end,
            updated_at = now()
          where job_id = ${jobId} and position = ${position}`;
        await publishStreamEvent(tx, {
          topic: topicOf.run(job.run_id),
          kind: 'job.updated',
          data: { id: jobId, runId: job.run_id, state: job.state },
        });
      });
    },

    async logs(jobId: string, token: string | undefined, chunk: LogChunkUpload) {
      const sql = requireDatabase(deps);
      const job = await jobFromToken(sql, jobId, token);
      return deps.logs.append(sql, job, chunk, await secretValues(job));
    },

    async tests(jobId: string, token: string | undefined, report: TestReportUpload) {
      const sql = requireDatabase(deps);
      const job = await jobFromToken(sql, jobId, token);
      const masked = maskedReport(report, createMasker(await secretValues(job)));
      await sql.begin(async (tx) => {
        const [facts] = await tx<{ commit_sha: string; mainline: boolean }[]>`
          select r.commit_sha, (r.ref = coalesce(p.default_branch, 'main')
              and r.trigger in ('push', 'schedule', 'manual', 'rerun')) as mainline
          from pipeline_runs r left join pipeline_repositories p on p.id = r.repository_id
          where r.id = ${job.run_id}`;
        await ingestReport(
          tx,
          { ...job, commit_sha: facts?.commit_sha ?? '', mainline: facts?.mainline ?? false },
          masked,
        );
      });
    },

    async splits(
      jobId: string,
      token: string | undefined,
      body: SplitsBody,
    ): Promise<SplitsResponse> {
      const sql = requireDatabase(deps);
      const job = await jobFromToken(sql, jobId, token);
      return deps.tests.splits(sql, job, body.files);
    },

    async secrets(jobId: string, token: string | undefined) {
      const sql = requireDatabase(deps);
      const job = await jobFromToken(sql, jobId, token);
      return { values: await secretsForRunner(sql, deps.secrets, job, LIVE_JOB) };
    },

    async artifact(
      jobId: string,
      token: string | undefined,
      name: string,
      body: Buffer,
      contentType: string,
    ) {
      const sql = requireDatabase(deps);
      const job = await jobFromToken(sql, jobId, token);
      return uploadArtifact(sql, deps.objects, job, name, body, contentType);
    },

    async finish(jobId: string, token: string | undefined, body: FinishInput): Promise<void> {
      const sql = requireDatabase(deps);
      const job = await jobFromToken(sql, jobId, token);
      const mask = createMasker(await secretValues(job));
      masks.delete(jobId);
      const summary =
        body.failureSummary === undefined ? {} : { failureSummary: mask(body.failureSummary) };
      const outcome = await finishJob(sql, deps.logs, job, { ...body, ...summary });
      if (!outcome) return;
      await queueCheck(deps, job, body.state);
      await announce(deps, [outcome]);
    },
  };
}

export type RunnerService = ReturnType<typeof createRunnerService>;
