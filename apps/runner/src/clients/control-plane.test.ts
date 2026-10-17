import {
  RUNNER_PROTOCOL_HEADER,
  RUNNER_PROTOCOL_VERSION,
  RUNNER_TOKEN_HEADER,
} from '@bemmoly/module-pipelines/shared';
import { ConflictError, ProviderError, UnauthenticatedError } from '@bemmoly/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeControlPlane } from '../../test/fake-control-plane.ts';
import { createLogger } from '../config/logger.ts';
import { ControlPlaneClient } from './control-plane.ts';
import { isUnauthenticated } from './http.ts';

let server: FakeControlPlane;
let client: ControlPlaneClient;
const job = { jobId: '0190a0a0-0000-7000-8000-000000000001', jobToken: 'job-tok' };

beforeEach(async () => {
  server = await new FakeControlPlane().start();
  client = new ControlPlaneClient({
    url: server.url,
    logger: createLogger('silent'),
    retry: { attempts: 3, baseMs: 5, maxMs: 10 },
  });
});

afterEach(() => server.stop());

describe('the control-plane client', () => {
  it('names the protocol version and the runner token, and reads 204 as no job', async () => {
    expect(await client.claim('runner-token-1', 0)).toBeNull();
    const call = server.of('/claims')[0]!;
    expect(call.headers[RUNNER_PROTOCOL_HEADER]).toBe(RUNNER_PROTOCOL_VERSION);
    expect(call.headers[RUNNER_TOKEN_HEADER]).toBe('runner-token-1');
    expect(call.body).toEqual({ waitSeconds: 0 });
  });

  it('retries a 5xx and gives up with a provider error after the bound', async () => {
    let calls = 0;
    server.override = () => (calls++ < 2 ? { status: 503 } : undefined);
    await client.jobState(job, { state: 'running', at: new Date().toISOString() });
    expect(calls).toBe(3);
    server.override = () => ({ status: 502 });
    await expect(
      client.finish(job, { state: 'passed', at: new Date().toISOString() }),
    ).rejects.toThrow(ProviderError);
  });

  it('turns a 401 into an error that says which token was refused', async () => {
    const error = await client.claim('wrong', 0).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthenticatedError);
    expect(isUnauthenticated(error, 'runner')).toBe(true);
    expect(isUnauthenticated(error, 'job')).toBe(false);
  });

  it('reads the error body of other refusals', async () => {
    server.override = () => ({ status: 409, body: { code: 'conflict', message: 'Job finished' } });
    await expect(
      client.stepState(job, 0, { state: 'passed', at: new Date().toISOString() }),
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ConflictError && error.message === 'Job finished',
    );
  });

  it('refuses an answer that does not match the contract', async () => {
    server.override = () => ({ status: 200, body: { cancel: 'maybe' } });
    await expect(client.heartbeat('runner-token-1', { state: 'idle' })).rejects.toThrow(
      /does not understand/,
    );
  });

  it('uploads an artifact as a raw body', async () => {
    await client.uploadArtifact(job, 'report.html', () => ({ body: '<p>hi</p>', length: 9 }));
    const call = server.of('/artifacts')[0]!;
    expect(call.method).toBe('PUT');
    expect(call.path).toBe(`/jobs/${job.jobId}/artifacts?name=report.html`);
    expect(call.headers['content-type']).toBe('application/octet-stream');
    expect(call.raw.toString()).toBe('<p>hi</p>');
  });
});
