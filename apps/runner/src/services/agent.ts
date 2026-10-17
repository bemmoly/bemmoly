import type { ClaimedJob } from '@bemmoly/module-pipelines/shared';
import { ProviderError } from '@bemmoly/shared';
import type { ControlPlaneClient } from '../clients/control-plane.ts';
import { isUnauthenticated } from '../clients/http.ts';
import type { Logger } from '../config/logger.ts';
import { backoffMs, sleep } from '../utils/time.ts';
import { JobRun, type JobDeps, type JobOutcome } from './job.ts';
import { resendOutbox } from './logs.ts';
import {
  ensureRegistration,
  forgetRegistration,
  register,
  type Registration,
  type RegistrationDeps,
} from './registration.ts';

export interface AgentDeps {
  client: ControlPlaneClient;
  logger: Logger;
  registration: RegistrationDeps;
  job: Omit<JobDeps, 'client' | 'logger'>;
  /** Exit after one job: the ephemeral mode, one VM or pod per job. */
  once: boolean;
  claimWaitSeconds?: number;
}

const CLAIM_WAIT_SECONDS = 30;
const EARLY_EMPTY_MS = 1_000;

/**
 * The runner's life: register, then claim one job at a time while heartbeating. A heartbeat can
 * cancel the running job or ask the runner to drain; a stop finishes the running job first.
 */
export class Agent {
  private registration: Registration | undefined;
  private current: JobRun | undefined;
  private stopping = false;
  private draining = false;
  private readonly claimAbort = new AbortController();
  private readonly beatAbort = new AbortController();
  private stopRequests = 0;
  private reregistering: Promise<Registration> | undefined;
  readonly outcomes: JobOutcome[] = [];

  private readonly deps: AgentDeps;

  constructor(deps: AgentDeps) {
    this.deps = deps;
  }

  async run(): Promise<void> {
    const { deps } = this;
    this.registration = await ensureRegistration(deps.registration);
    await this.resendLeftovers();
    const heartbeats = this.heartbeatLoop();
    try {
      while (!this.stopping && !this.draining) {
        const job = await this.claim();
        if (!job) continue;
        await this.runJob(job);
        if (deps.once) break;
        await this.resendLeftovers();
      }
    } finally {
      this.beatAbort.abort();
      await heartbeats;
    }
  }

  /** First call: stop claiming and let the running job end. Second call: cancel that job too. */
  stop(): void {
    this.stopRequests++;
    this.stopping = true;
    this.claimAbort.abort();
    if (this.stopRequests > 1 && this.current) {
      this.deps.logger.warn('stopping now: cancelling the running job');
      this.current.cancel('cancelled');
    }
  }

  get busy(): boolean {
    return this.current !== undefined;
  }

  private async runJob(job: ClaimedJob): Promise<void> {
    const { deps } = this;
    deps.logger.info({ jobId: job.jobId, key: job.key, attempt: job.attempt }, 'claimed a job');
    const run = new JobRun(job, { ...deps.job, client: deps.client, logger: deps.logger });
    this.current = run;
    try {
      const outcome = await run.run();
      this.outcomes.push(outcome);
      deps.logger.info({ jobId: job.jobId, outcome }, 'job done');
    } finally {
      this.current = undefined;
    }
  }

  private async claim(): Promise<ClaimedJob | null> {
    const wait = this.deps.claimWaitSeconds ?? CLAIM_WAIT_SECONDS;
    for (let failures = 0; !this.stopping && !this.draining; failures++) {
      try {
        const asked = Date.now();
        const job = await this.withRunnerToken((token) =>
          this.deps.client.claim(token, wait, this.claimAbort.signal),
        );
        // An empty answer well before the wait it asked for means the server did not hold the
        // poll: pause instead of asking again at once, so a fault there never becomes a flood.
        if (!job && wait > 0 && Date.now() - asked < EARLY_EMPTY_MS) {
          await sleep(EARLY_EMPTY_MS, this.claimAbort.signal);
        }
        return job;
      } catch (error) {
        if (this.claimAbort.signal.aborted) return null;
        if (!(error instanceof ProviderError)) throw error;
        // The control plane is down: wait and ask again, never give up the process.
        const pause = backoffMs(failures, 1_000, 60_000);
        this.deps.logger.warn({ err: error.message, pause }, 'could not claim; trying again');
        await sleep(pause, this.claimAbort.signal);
      }
    }
    return null;
  }

  private async heartbeatLoop(): Promise<void> {
    const signal = this.beatAbort.signal;
    while (!signal.aborted) {
      await this.beat();
      const seconds = this.registration?.heartbeatSeconds ?? 10;
      await sleep(seconds * 1000, signal);
    }
  }

  private async beat(): Promise<void> {
    const job = this.current;
    const state = job ? 'busy' : this.stopping || this.draining ? 'draining' : 'idle';
    try {
      const answer = await this.withRunnerToken((token) =>
        this.deps.client.heartbeat(token, { state, jobId: job?.job.jobId ?? null }),
      );
      if (answer.cancel && job) {
        this.deps.logger.info({ jobId: job.job.jobId }, 'the control plane cancelled the job');
        job.cancel('cancelled');
      }
      if (answer.drain && !this.draining) {
        this.deps.logger.info('draining: finishing the current job, then exiting');
        this.draining = true;
        if (!this.current) this.claimAbort.abort();
      }
    } catch (error) {
      this.deps.logger.warn({ err: (error as Error).message }, 'heartbeat failed');
    }
  }

  /**
   * Runs a call with the runner token. A 401 means the registration is gone (the runner was
   * removed or its pool's token rotated): forget it, register again once, and retry.
   */
  private async withRunnerToken<T>(call: (token: string) => Promise<T>): Promise<T> {
    const current = this.registration ?? (await ensureRegistration(this.deps.registration));
    try {
      return await call(current.runnerToken);
    } catch (error) {
      if (!isUnauthenticated(error, 'runner')) throw error;
      // The heartbeat and a claim can both meet the 401; only one of them registers again.
      if (this.registration && this.registration.runnerToken !== current.runnerToken) {
        return call(this.registration.runnerToken);
      }
      this.reregistering ??= this.reregister().finally(() => {
        this.reregistering = undefined;
      });
      return call((await this.reregistering).runnerToken);
    }
  }

  private async reregister(): Promise<Registration> {
    this.deps.logger.warn('the control plane no longer knows this runner; registering again');
    await forgetRegistration(this.deps.registration.dataDir);
    this.registration = await register(this.deps.registration);
    return this.registration;
  }

  private async resendLeftovers(): Promise<void> {
    const outbox = this.deps.job.outbox;
    await resendOutbox(
      await outbox.pending(),
      (job, chunk) => this.deps.client.logs(job, chunk),
      this.deps.logger,
    );
  }
}
