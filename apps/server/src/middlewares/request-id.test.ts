import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { shippedModules, TEST_ENV } from '../test-support.ts';

describe('request id', () => {
  it('appears as requestId on every log line, with one summary line per request', async () => {
    const lines: Record<string, unknown>[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
        done();
      },
    });
    const app = await buildApp({
      env: TEST_ENV,
      modules: await shippedModules(),
      logger: { stream },
    });
    const response = await app.inject({
      url: '/api/v1/modules',
      headers: { 'x-request-id': 'trace-0001' },
    });
    expect(response.headers['x-request-id']).toBe('trace-0001');
    const rejected = await app.inject({
      url: '/api/v1/nothing-here',
      headers: { 'x-request-id': 'trace-0002' },
    });
    expect(rejected.statusCode).toBe(404);
    const requestLines = lines.filter((line) => 'requestId' in line);
    expect(requestLines.filter((line) => line['requestId'] === 'trace-0002').length).toBe(2);
    expect(requestLines.every((line) => String(line['requestId']).startsWith('trace-000'))).toBe(
      true,
    );
    const summaries = lines.filter((line) => line['msg'] === 'request completed');
    expect(summaries).toEqual([
      expect.objectContaining({
        requestId: 'trace-0001',
        method: 'GET',
        route: '/api/v1/modules',
        status: 200,
        durationMs: expect.any(Number),
      }),
      expect.objectContaining({ requestId: 'trace-0002', status: 404, code: 'not_found' }),
    ]);
  });
});
