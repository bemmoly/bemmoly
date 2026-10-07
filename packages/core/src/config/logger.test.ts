import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createLoggerOptions, REDACTED } from './logger.ts';

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  return { lines, stream };
}

describe('logger', () => {
  it('redacts cookies, authorization, API keys, tokens and passwords', () => {
    const { lines, stream } = capture();
    const options = createLoggerOptions({ LOG_LEVEL: 'info', LOG_FORMAT: 'json' });
    const logger = pino(options, stream);
    logger.info({
      req: { headers: { cookie: 'sid=abc', authorization: 'Bearer xyz', 'x-api-key': 'k1' } },
      user: { password: 'hunter2', apiKey: 'k2' },
      smtp: { auth: { password: 'p3' } },
      token: 't4',
    });
    const line = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(JSON.stringify(line)).not.toMatch(/abc|xyz|k1|hunter2|k2|p3|t4/);
    expect(line).toMatchObject({ token: REDACTED, user: { password: REDACTED, apiKey: REDACTED } });
  });

  it('uses a pretty transport only when asked', () => {
    expect(
      createLoggerOptions({ LOG_LEVEL: 'debug', LOG_FORMAT: 'json' }).transport,
    ).toBeUndefined();
    expect(
      createLoggerOptions({ LOG_LEVEL: 'debug', LOG_FORMAT: 'pretty' }).transport,
    ).toMatchObject({
      target: 'pino-pretty',
    });
  });
});
