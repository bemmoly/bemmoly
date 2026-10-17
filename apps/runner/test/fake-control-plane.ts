import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  JOB_TOKEN_HEADER,
  RUNNER_TOKEN_HEADER,
  type ClaimedJob,
  type HeartbeatResponse,
} from '@bemmoly/module-pipelines/shared';

export interface RecordedCall {
  method: string;
  /** The path under /api/v1/runner, with the query. */
  path: string;
  headers: IncomingMessage['headers'];
  body: unknown;
  raw: Buffer;
}

type Answer = { status: number; body?: unknown };
type Override = (call: RecordedCall) => Answer | undefined;

/**
 * A control plane in a few dozen lines: the runner protocol's routes on a random port, every
 * call recorded, answers steerable from the test.
 */
export class FakeControlPlane {
  readonly calls: RecordedCall[] = [];
  readonly jobs: ClaimedJob[] = [];
  heartbeat: HeartbeatResponse = { cancel: false, drain: false };
  heartbeatSeconds = 10;
  secrets: Record<string, string> = {};
  /** The next this many log uploads answer 503. */
  failLogs = 0;
  runnerToken = 'runner-token-1';
  override: Override | undefined;
  url = '';
  private server: Server | undefined;

  async start(): Promise<this> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    this.url = `http://127.0.0.1:${port}`;
    return this;
  }

  async stop(): Promise<void> {
    this.server?.closeAllConnections();
    await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve());
  }

  of(pathPart: string | RegExp, method?: string): RecordedCall[] {
    return this.calls.filter(
      (call) =>
        (method === undefined || call.method === method) &&
        (typeof pathPart === 'string' ? call.path.includes(pathPart) : pathPart.test(call.path)),
    );
  }

  async waitFor(check: () => boolean, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!check()) {
      if (Date.now() > deadline) throw new Error('waitFor timed out');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks);
    let body: unknown;
    try {
      body = req.headers['content-type']?.includes('json') ? JSON.parse(raw.toString()) : undefined;
    } catch {
      body = undefined;
    }
    const call: RecordedCall = {
      method: req.method ?? 'GET',
      path: (req.url ?? '').replace(/^\/api\/v1\/runner/, ''),
      headers: req.headers,
      body,
      raw,
    };
    this.calls.push(call);
    const answer = this.override?.(call) ?? (await this.route(call));
    res.statusCode = answer.status;
    if (answer.body === undefined) return void res.end();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(answer.body));
  }

  private async route(call: RecordedCall): Promise<Answer> {
    const { method, path } = call;
    if (method === 'POST' && path === '/register') {
      return {
        status: 201,
        body: {
          runnerId: randomUUID(),
          runnerToken: this.runnerToken,
          pool: { id: randomUUID(), key: 'default' },
          heartbeatSeconds: this.heartbeatSeconds,
        },
      };
    }
    if (path === '/heartbeat' || path === '/claims') {
      if (call.headers[RUNNER_TOKEN_HEADER] !== this.runnerToken) {
        return { status: 401, body: { code: 'unauthenticated', message: 'Unknown runner' } };
      }
      if (path === '/heartbeat') return { status: 200, body: this.heartbeat };
      const job = this.jobs.shift();
      if (job) return { status: 200, body: { job } };
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { status: 204 };
    }
    const match = /^\/jobs\/([^/]+)(\/.*)$/.exec(path);
    if (!match) return { status: 404, body: { code: 'not_found', message: 'No such route' } };
    if (!call.headers[JOB_TOKEN_HEADER]) return { status: 401, body: { code: 'unauthenticated' } };
    const rest = match[2]!;
    if (rest === '/logs') {
      if (this.failLogs > 0) {
        this.failLogs--;
        return { status: 503, body: { code: 'unavailable', message: 'Down' } };
      }
      return { status: 202 };
    }
    if (rest === '/secrets') return { status: 200, body: { values: this.secrets } };
    if (rest === '/splits') {
      const files = (call.body as { files: string[] }).files;
      return {
        status: 200,
        body: { files: files.filter((_, i) => i % 2 === 0), expectedSeconds: 7 },
      };
    }
    if (rest.startsWith('/artifacts')) {
      const name = new URL(`http://x${rest}`).searchParams.get('name') ?? '';
      return {
        status: 201,
        body: {
          id: randomUUID(),
          name,
          size: call.raw.length,
          contentType: 'application/octet-stream',
          createdAt: new Date().toISOString(),
        },
      };
    }
    return { status: 204 };
  }
}

/** A claimed job with sensible defaults, for tests to override. */
export function makeJob(overrides: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    jobId: randomUUID(),
    runId: randomUUID(),
    runNumber: 42,
    key: 'test',
    name: 'Test',
    kind: 'test',
    attempt: 1,
    jobToken: 'job-token-abcdef',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    timeoutMinutes: 60,
    repository: {
      fullName: 'acme/shop',
      cloneUrl: 'https://example.invalid/acme/shop.git',
      commitSha: 'a'.repeat(40),
      ref: 'refs/heads/main',
    },
    shard: null,
    matrix: null,
    checkout: false,
    steps: [],
    env: {},
    secrets: [],
    cacheKeys: [],
    oidcIssuer: null,
    ...overrides,
  };
}

export function makeStep(
  key: string,
  run: string,
  extra: Partial<ClaimedJob['steps'][number]> = {},
): ClaimedJob['steps'][number] {
  return {
    key,
    name: key,
    image: null,
    run,
    uses: null,
    env: {},
    secrets: [],
    locked: false,
    origin: 'application',
    junit: null,
    artifacts: [],
    ...extra,
  };
}
