import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { shippedModules, TEST_ENV } from '../test-support.ts';

describe('request id', () => {
  it('appears as requestId on every log line of a request', async () => {
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
    const requestLines = lines.filter((line) => 'requestId' in line);
    expect(response.headers['x-request-id']).toBe('trace-0001');
    expect(requestLines.length).toBeGreaterThanOrEqual(2);
    expect(requestLines.every((line) => line['requestId'] === 'trace-0001')).toBe(true);
  });
});
