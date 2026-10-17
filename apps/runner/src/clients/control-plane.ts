import {
  JOB_TOKEN_HEADER,
  RUNNER_PROTOCOL_HEADER,
  RUNNER_PROTOCOL_VERSION,
  RUNNER_TOKEN_HEADER,
  claimResponseSchema,
  heartbeatResponseSchema,
  jobSecretsResponseSchema,
  registerRunnerResponseSchema,
  splitsResponseSchema,
  type ClaimedJob,
  type FinishJobBody,
  type HeartbeatBody,
  type HeartbeatResponse,
  type JobStateBody,
  type LogChunkUpload,
  type RegisterRunnerBody,
  type RegisterRunnerResponse,
  type SplitsResponse,
  type StepStateBody,
  type TestReportUpload,
} from '@bemmoly/module-pipelines/shared';
import { ProviderError } from '@bemmoly/shared';
import type { Logger } from '../config/logger.ts';
import { sendWithRetry, type HttpRequest, type OpenRawBody, type RetryPolicy } from './http.ts';

/** The job a call is about, and the short-lived token that proves the runner holds it. */
export interface JobRef {
  jobId: string;
  jobToken: string;
}

export interface ControlPlaneOptions {
  /** The Bemmoly address, without /api/v1/runner. */
  url: string;
  logger: Logger;
  /** Overrides the default bounded retry, for tests. */
  retry?: RetryPolicy;
}

const TIMEOUT_MS = 15_000;
/** The server holds a claim open for up to waitSeconds; this is the slack on top. */
const CLAIM_SLACK_MS = 15_000;
const LOGS_TIMEOUT_MS = 30_000;
const ARTIFACT_TIMEOUT_MS = 10 * 60_000;

/** The runner protocol, version 1, as the runner sees it: one method per endpoint. */
export class ControlPlaneClient {
  readonly base: string;
  private readonly options: ControlPlaneOptions;

  constructor(options: ControlPlaneOptions) {
    this.options = options;
    this.base = `${options.url}/api/v1/runner`;
  }

  async register(body: RegisterRunnerBody): Promise<RegisterRunnerResponse> {
    const { data } = await this.send({
      method: 'POST',
      path: '/register',
      json: body,
      ok: [201, 200],
      schema: registerRunnerResponseSchema,
      scope: 'pool',
    });
    return required(data);
  }

  async heartbeat(runnerToken: string, body: HeartbeatBody): Promise<HeartbeatResponse> {
    const { data } = await this.send({
      method: 'POST',
      path: '/heartbeat',
      headers: { [RUNNER_TOKEN_HEADER]: runnerToken },
      json: body,
      ok: [200],
      schema: heartbeatResponseSchema,
      scope: 'runner',
    });
    return required(data);
  }

  /** One long poll: a job, or null when the server had nothing within waitSeconds. */
  async claim(
    runnerToken: string,
    waitSeconds: number,
    signal?: AbortSignal,
  ): Promise<ClaimedJob | null> {
    const { status, data } = await this.send({
      method: 'POST',
      path: '/claims',
      headers: { [RUNNER_TOKEN_HEADER]: runnerToken },
      json: { waitSeconds },
      ok: [200, 204],
      schema: claimResponseSchema,
      scope: 'runner',
      timeoutMs: waitSeconds * 1000 + CLAIM_SLACK_MS,
      signal,
    });
    return status === 204 || !data ? null : data.job;
  }

  async jobState(job: JobRef, body: JobStateBody): Promise<void> {
    await this.sendJob(job, { method: 'POST', path: '/state', json: body, ok: [204, 200] });
  }

  async stepState(job: JobRef, position: number, body: StepStateBody): Promise<void> {
    await this.sendJob(job, {
      method: 'POST',
      path: `/steps/${position}/state`,
      json: body,
      ok: [204, 200],
    });
  }

  /** One attempt only: the log outbox owns retrying, so chunks stay in order. */
  async logs(job: JobRef, chunk: LogChunkUpload): Promise<void> {
    await this.sendJob(job, {
      method: 'POST',
      path: '/logs',
      json: chunk,
      ok: [202, 204, 200],
      timeoutMs: LOGS_TIMEOUT_MS,
      retry: { attempts: 1, baseMs: 0, maxMs: 0 },
    });
  }

  async tests(job: JobRef, report: TestReportUpload): Promise<void> {
    await this.sendJob(job, { method: 'POST', path: '/tests', json: report, ok: [204, 200, 201] });
  }

  async splits(job: JobRef, files: string[]): Promise<SplitsResponse> {
    const { data } = await this.sendJob(job, {
      method: 'POST',
      path: '/splits',
      json: { files },
      ok: [200],
      schema: splitsResponseSchema,
    });
    return required(data);
  }

  async secrets(job: JobRef): Promise<Record<string, string>> {
    const { data } = await this.sendJob(job, {
      method: 'GET',
      path: '/secrets',
      ok: [200],
      schema: jobSecretsResponseSchema,
    });
    return required(data).values;
  }

  async uploadArtifact(job: JobRef, name: string, open: OpenRawBody): Promise<void> {
    await this.sendJob(job, {
      method: 'PUT',
      path: `/artifacts?name=${encodeURIComponent(name)}`,
      raw: open,
      ok: [201, 200, 204],
      timeoutMs: ARTIFACT_TIMEOUT_MS,
    });
  }

  async finish(job: JobRef, body: FinishJobBody, retry?: RetryPolicy): Promise<void> {
    await this.sendJob(job, {
      method: 'POST',
      path: '/finish',
      json: body,
      ok: [204, 200],
      ...(retry ? { retry } : {}),
    });
  }

  private sendJob<T>(job: JobRef, call: JobCall<T>) {
    return this.send({
      ...call,
      path: `/jobs/${encodeURIComponent(job.jobId)}${call.path}`,
      headers: { [JOB_TOKEN_HEADER]: job.jobToken },
      scope: 'job',
    });
  }

  private send<T>(call: Call<T>) {
    const request: HttpRequest<T> = {
      method: call.method,
      url: `${this.base}${call.path}`,
      headers: { [RUNNER_PROTOCOL_HEADER]: RUNNER_PROTOCOL_VERSION, ...call.headers },
      json: call.json,
      raw: call.raw,
      timeoutMs: call.timeoutMs ?? TIMEOUT_MS,
      ok: call.ok,
      schema: call.schema,
      scope: call.scope,
      signal: call.signal,
      retry: call.retry ?? this.options.retry,
    };
    return sendWithRetry(request, this.options.logger);
  }
}

interface Call<T> {
  method: HttpRequest<T>['method'];
  path: string;
  headers?: Record<string, string>;
  json?: unknown;
  raw?: HttpRequest<T>['raw'];
  ok: readonly number[];
  schema?: HttpRequest<T>['schema'];
  scope: HttpRequest<T>['scope'];
  timeoutMs?: number;
  signal?: AbortSignal;
  retry?: RetryPolicy;
}

type JobCall<T> = Omit<Call<T>, 'scope' | 'headers'>;

function required<T>(data: T | undefined): T {
  if (data === undefined) {
    throw new ProviderError('The control plane sent an empty answer', {
      provider: 'control-plane',
    });
  }
  return data;
}
