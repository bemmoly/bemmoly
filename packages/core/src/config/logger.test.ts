import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { createLoggerOptions, hashUserId, REDACTED } from './logger.ts';

const SECRET_KEY = Buffer.alloc(32, 7).toString('base64');

interface Fixture {
  events: Array<Record<string, unknown> & { msg: string }>;
}

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/log-events.json', import.meta.url), 'utf8'),
) as Fixture;

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

function logFixture(secretKey?: string) {
  const { lines, stream } = capture();
  const options = createLoggerOptions({
    LOG_LEVEL: 'info',
    LOG_FORMAT: 'json',
    ...(secretKey ? { BEMMOLY_SECRET_KEY: secretKey } : {}),
  });
  const logger = pino(options, stream);
  for (const { msg, ...event } of fixture.events) logger.info(event, msg);
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('logger', () => {
  it('never writes a fixture value marked LEAK, and keeps the ones marked KEEP', () => {
    const output = logFixture(SECRET_KEY).map((line) => JSON.stringify(line));
    expect(output).toHaveLength(fixture.events.length);
    const all = output.join('\n');
    expect(all).not.toMatch(/LEAK/);
    for (const kept of ['KEEP-agent', 'KEEP-smtp', 'KEEP-recipient', 'KEEP-subject', 'KEEP-standard']) {
      expect(all).toContain(kept);
    }
  });

  it('redacts cookies, authorization, API keys, passwords, email bodies and prompt text', () => {
    const [request, smtp, email, ai] = logFixture(SECRET_KEY);
    expect(request).toMatchObject({
      req: { headers: { cookie: REDACTED, authorization: REDACTED, 'x-api-key': REDACTED } },
    });
    expect(smtp).toMatchObject({ smtp: { auth: { password: REDACTED } } });
    expect(email).toMatchObject({ email: { html: REDACTED, text: REDACTED, body: REDACTED } });
    expect(ai).toMatchObject({
      ai: { prompt: REDACTED, messages: REDACTED, usage: { inputTokens: 1200 } },
      provider: { apiKey: REDACTED },
    });
  });

  it('writes user ids hashed, keyed with the install secret', () => {
    const rawUser = '0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1b';
    const [, smtp, , ai] = logFixture(SECRET_KEY);
    expect(smtp?.['userId']).toBe(hashUserId(rawUser, SECRET_KEY));
    expect(smtp?.['userId']).toMatch(/^u_[0-9a-f]{16}$/);
    expect(ai?.['actorId']).toMatch(/^u_[0-9a-f]{16}$/);
    expect(hashUserId(rawUser, SECRET_KEY)).not.toBe(hashUserId(rawUser));
    expect(hashUserId(rawUser)).toBe(hashUserId(rawUser));
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
