import { Writable } from 'node:stream';
import Fastify, { LogController } from 'fastify';
import { describe, expect, it } from 'vitest';
import { redactUrl } from './log-urls.ts';
import { createLoggerOptions } from './logger.ts';

/** Shaped like a real token (43 base64url characters) but plainly fake. */
const TOKEN = 'fake_invitation_token_for_tests'.padEnd(43, 'x');

describe('URL redaction in logs', () => {
  it.each([
    [`/api/v1/auth/invitations/${TOKEN}`, '/api/v1/auth/invitations/[redacted]'],
    [`/api/v1/auth/invitations/${TOKEN}/accept`, '/api/v1/auth/invitations/[redacted]/accept'],
    ['/api/v1/auth/invitations/short-token', '/api/v1/auth/invitations/[redacted]'],
    [`/api/v1/auth/password-resets/${TOKEN}`, '/api/v1/auth/password-resets/[redacted]'],
    [
      `/api/v1/auth/sso/callback?code=abc&state=def&x=1`,
      '/api/v1/auth/sso/callback?code=[redacted]&state=[redacted]&x=1',
    ],
    [`/api/v1/exports/download?token=${TOKEN}`, '/api/v1/exports/download?token=[redacted]'],
  ])('redacts %s', (url, expected) => {
    expect(redactUrl(url)).toBe(expected);
    expect(redactUrl(url)).not.toContain(TOKEN);
  });

  it.each(['/api/v1/modules', '/api/v1/auth/sessions', `/api/v1/issues/${TOKEN}`, '/healthz'])(
    'leaves %s alone',
    (url) => {
      expect(redactUrl(url)).toBe(url);
    },
  );

  it('keeps invitation tokens out of every line Fastify and handlers write', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const app = Fastify({
      logger: { ...createLoggerOptions({ LOG_LEVEL: 'info', LOG_FORMAT: 'json' }), stream },
      logController: new LogController({ requestIdLogLabel: 'requestId' }),
    });
    app.get('/api/v1/auth/invitations/:token', async (request) => {
      request.log.info({ url: request.url }, 'invitation opened');
      request.log.info({ req: request }, 'invitation request');
      return { ok: true };
    });
    const response = await app.inject({ url: `/api/v1/auth/invitations/${TOKEN}?token=${TOKEN}` });
    expect(response.statusCode).toBe(200);
    const all = lines.join('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(all).toContain('/api/v1/auth/invitations/[redacted]');
    expect(all).not.toContain(TOKEN);
  });
});
