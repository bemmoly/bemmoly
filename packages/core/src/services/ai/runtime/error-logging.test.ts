import { Writable } from 'node:stream';
import { APICallError } from 'ai';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { createLoggerOptions } from '../../../config/logger.ts';
import { toProviderError } from './errors.ts';

const KEY = ['sk', 'live', '0123456789abcdefghijklmnop'].join('-');
const PROMPT = 'Salary bands for the platform team';

/** What one error log line would carry for a provider failure, as the error handler logs it. */
function logged(error: unknown): string {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, done) {
      lines.push(String(chunk));
      done();
    },
  });
  // JSON lines, as production writes them: no transport.
  const options = createLoggerOptions({
    LOG_LEVEL: 'info',
    LOG_FORMAT: 'json',
    BEMMOLY_SECRET_KEY: Buffer.alloc(32, 1).toString('base64'),
  } as never);
  pino(options, sink).error({ err: error }, 'request failed');
  return lines.join('');
}

describe('a provider failure in the logs', () => {
  it('carries neither the key, the prompt nor the raw response', () => {
    const raw = new APICallError({
      message: `Incorrect API key provided: ${KEY}`,
      url: 'https://api.acme.test/v1/chat/completions',
      requestBodyValues: { messages: [{ role: 'user', content: PROMPT }] },
      statusCode: 401,
      responseHeaders: { 'x-request-id': 'r1' },
      responseBody: JSON.stringify({ error: { message: `Incorrect API key provided: ${KEY}` } }),
    });
    const line = logged(toProviderError(raw, 'Acme AI'));
    expect(line).toContain('Acme AI refused the credentials');
    expect(line).not.toContain(KEY);
    expect(line).not.toContain(PROMPT);
  });
});
