import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import type { ClaimedJob, StepStateBody } from '@bemmoly/module-pipelines/shared';
import type { ControlPlaneClient, JobRef } from '../clients/control-plane.ts';
import { isUnauthenticated, type RetryPolicy } from '../clients/http.ts';
import type { Logger } from '../config/logger.ts';
import type { Executors, StepExecutor } from '../executors/index.ts';
import { dim } from '../utils/lines.ts';
import { SecretMasker } from '../utils/mask.ts';
import { nowIso } from '../utils/time.ts';
import { uploadArtifacts } from './artifacts.ts';
import { checkout, cloneCredentials } from './checkout.ts';
import { ErrorLineCatcher, prepareStep } from './job-step.ts';
import { collectJUnit } from './junit.ts';
import { LogStream } from './logs.ts';
import type { Outbox } from './outbox.ts';
import { stepEnv } from './step-env.ts';

export interface JobDeps {
  client: ControlPlaneClient;
  executors: Executors;
  outbox: Outbox;
  logger: Logger;
  /** Per-job workspaces live under here, unless `workspace` names one to reuse. */
  workRoot: string;
  workspace?: string;
  /** The address steps call back on (bemmoly-runner split). */
  apiUrl: string;
  /** How long a finished job waits for its logs to land before finishing anyway. */
  drainBoundMs?: number;
  finishRetry?: RetryPolicy;
}

export type JobOutcome = 'passed' | 'failed' | 'cancelled' | 'lost';
type StopReason = 'cancelled' | 'timeout' | 'lost';

const DEFAULT_DRAIN_MS = 10 * 60_000;
/** Finishing matters more than any other call: keep at it for a few minutes. */
const FINISH_RETRY: RetryPolicy = { attempts: 20, baseMs: 1_000, maxMs: 30_000 };

/** One claimed job, from check out to finish. */
export class JobRun {
  private current: StepExecutor | undefined;
  private stopReason: StopReason | undefined;
  private readonly ref: JobRef;
  private readonly masker = new SecretMasker();
  private logs!: LogStream;

  readonly job: ClaimedJob;
  private readonly deps: JobDeps;

  constructor(job: ClaimedJob, deps: JobDeps) {
    this.job = job;
    this.deps = deps;
    this.ref = { jobId: job.jobId, jobToken: job.jobToken };
    this.masker.add([job.jobToken, ...cloneCredentials(job.repository.cloneUrl)]);
  }

  /** Stops the running step; the job then finishes as cancelled (or failed, on a timeout). */
  cancel(reason: StopReason = 'cancelled'): void {
    this.stopReason ??= reason;
    void this.current?.cancel();
  }

  async run(): Promise<JobOutcome> {
    const { job, deps } = this;
    const outbox = await deps.outbox.open({
      jobId: job.jobId,
      jobToken: job.jobToken,
      expiresAt: job.expiresAt,
    });
    this.logs = new LogStream({
      send: (chunk) => deps.client.logs(this.ref, chunk),
      outbox,
      masker: this.masker,
      logger: deps.logger,
      onLost: () => this.cancel('lost'),
    });
    const timeout = setTimeout(() => this.cancel('timeout'), job.timeoutMinutes * 60_000);
    let result: { state: 'passed' | 'failed' | 'cancelled'; summary?: string };
    try {
      result = await this.execute();
    } catch (error) {
      if (isUnauthenticated(error, 'job')) this.cancel('lost');
      const message = (error as Error).message;
      deps.logger.error({ err: error, jobId: job.jobId }, 'job failed in the runner');
      this.logs.line(`The runner could not finish this job: ${message}`);
      result = { state: 'failed', summary: `The runner could not finish this job: ${message}` };
    } finally {
      clearTimeout(timeout);
    }

    const drained = await this.logs.close(deps.drainBoundMs ?? DEFAULT_DRAIN_MS);
    await this.cleanWorkspace();
    if (this.stopReason === 'lost') {
      deps.logger.warn({ jobId: job.jobId }, 'job was taken away from this runner');
      await outbox.discard();
      return 'lost';
    }
    if (!drained) deps.logger.warn({ jobId: job.jobId }, 'finishing with logs still in the outbox');
    try {
      await deps.client.finish(
        this.ref,
        {
          state: result.state,
          ...(result.summary ? { failureSummary: result.summary.slice(0, 2000) } : {}),
          at: nowIso(),
        },
        deps.finishRetry ?? FINISH_RETRY,
      );
    } catch (error) {
      deps.logger.error({ err: error, jobId: job.jobId }, 'could not report the job finished');
    }
    if (drained) await outbox.closeIfEmpty();
    return result.state;
  }

  private get workspace(): string {
    return this.deps.workspace ?? path.join(this.deps.workRoot, this.job.jobId);
  }

  private async execute(): Promise<{ state: 'passed' | 'failed' | 'cancelled'; summary?: string }> {
    const { job, deps, logs } = this;
    if (!deps.workspace) {
      await rm(this.workspace, { recursive: true, force: true });
      await mkdir(this.workspace, { recursive: true });
    }
    if (job.checkout && !deps.workspace) {
      this.current = deps.executors.host();
      const checkedOut = await checkout(job, this.current, this.workspace, (l) => logs.line(l));
      this.current = undefined;
      if (!checkedOut.ok) {
        await this.skipFrom(0, this.stopReason ? 'cancelled' : 'skipped');
        if (this.stopReason) return this.stopped();
        return {
          state: 'failed',
          summary: `Check out failed (git exited with ${checkedOut.exitCode})`,
        };
      }
    }
    await deps.client.jobState(this.ref, { state: 'running', at: nowIso() });
    const secrets = job.steps.some((step) => step.secrets.length > 0)
      ? await deps.client.secrets(this.ref)
      : {};
    this.masker.add(Object.values(secrets));

    let failure: string | undefined;
    for (const [position, step] of job.steps.entries()) {
      if (failure !== undefined || this.stopReason) {
        await this.stepState(position, { state: 'skipped', at: nowIso() });
        continue;
      }
      await this.stepState(position, { state: 'running', firstLine: logs.nextLine, at: nowIso() });
      const catcher = new ErrorLineCatcher(this.masker);
      const onLine = (line: string) => {
        catcher.see(line);
        logs.line(line, position);
      };
      const prepared = prepareStep(job, step, deps.executors);
      let exitCode: number;
      if ('refusal' in prepared) {
        onLine(prepared.refusal);
        exitCode = 1;
      } else {
        this.current = prepared.executor;
        if (this.stopReason) void prepared.executor.cancel();
        ({ exitCode } = await prepared.executor.run(prepared.step, {
          workspace: this.workspace,
          env: stepEnv(job, step, secrets, deps.apiUrl),
          onLine,
          label: `${job.jobId.slice(0, 8)}-${position}`,
        }));
        this.current = undefined;
      }
      if (step.junit) await this.reportTests(step.junit, position);
      if (this.stopReason) {
        await this.stepState(position, { state: 'cancelled', exitCode, at: nowIso() });
        continue;
      }
      const state = exitCode === 0 ? 'passed' : 'failed';
      await this.stepState(position, { state, exitCode, at: nowIso() });
      if (state === 'failed') failure = catcher.line ?? `${step.name} exited with ${exitCode}`;
    }

    await uploadArtifacts(
      job.steps,
      this.workspace,
      (name, open) => deps.client.uploadArtifact(this.ref, name, open),
      (line) => logs.line(dim(line)),
    );
    if (this.stopReason) return this.stopped();
    return failure === undefined ? { state: 'passed' } : { state: 'failed', summary: failure };
  }

  private stopped(): { state: 'failed' | 'cancelled'; summary?: string } {
    if (this.stopReason === 'timeout') {
      return {
        state: 'failed',
        summary: `The job ran past its ${this.job.timeoutMinutes}-minute timeout`,
      };
    }
    return { state: 'cancelled' };
  }

  private async skipFrom(start: number, state: 'skipped' | 'cancelled'): Promise<void> {
    for (let position = start; position < this.job.steps.length; position++) {
      await this.stepState(position, { state, at: nowIso() });
    }
  }

  private async stepState(position: number, body: StepStateBody): Promise<void> {
    await this.deps.client.stepState(this.ref, position, body);
  }

  /** Test results are a report, not a verdict: a missing or broken file never fails the job. */
  private async reportTests(pattern: string, position: number): Promise<void> {
    const line = (text: string) => this.logs.line(dim(text), position);
    try {
      const { report, files, problems } = await collectJUnit(pattern, this.workspace);
      for (const problem of problems) line(`Could not read ${problem.file}: ${problem.reason}`);
      if (!report) {
        if (files.length === 0) line(`No test reports matched ${pattern}`);
        return;
      }
      await this.deps.client.tests(this.ref, report);
      line(
        `Reported ${report.total} tests from ${files.length} file(s): ${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped`,
      );
    } catch (error) {
      if (isUnauthenticated(error, 'job')) throw error;
      line(`Could not report tests: ${(error as Error).message}`);
    }
  }

  private async cleanWorkspace(): Promise<void> {
    if (this.deps.workspace) return;
    await rm(this.workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
