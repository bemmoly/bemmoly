import type { IncomingMessage } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { tokenMatches, type UpdaterController } from '../controllers/updater.controller.ts';
import { route } from './updater.routes.ts';

const TOKEN = 't'.repeat(48);

function request(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body = '',
): IncomingMessage {
  return Object.assign(Readable.from(body ? [Buffer.from(body)] : []), {
    method,
    url,
    headers,
  }) as unknown as IncomingMessage;
}

const calls: string[] = [];
const controller: UpdaterController = {
  status: async () => ({ status: 200, body: { state: 'idle' } }),
  update: async (body) => {
    calls.push(`update ${JSON.stringify(body)}`);
    return { status: 202, body: {} };
  },
  rollback: async () => ({ status: 202, body: {} }),
  progressPage: async () => ({ status: 503, body: '<html>', html: true }),
};

describe('updater routes', () => {
  it('compares tokens in constant time and rejects anything else', () => {
    expect(tokenMatches(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(tokenMatches(`Bearer ${TOKEN.slice(1)}x`, TOKEN)).toBe(false);
    expect(tokenMatches(undefined, TOKEN)).toBe(false);
    expect(tokenMatches('Bearer short', TOKEN)).toBe(false);
  });

  it('requires the token for every API call', async () => {
    expect((await route(controller, TOKEN, request('GET', '/v1/status'))).status).toBe(401);
    expect(
      (await route(controller, TOKEN, request('POST', '/v1/update', {}, '{"tag":"1.3.0"}'))).status,
    ).toBe(401);
    const ok = await route(
      controller,
      TOKEN,
      request('GET', '/v1/status', { authorization: `Bearer ${TOKEN}` }),
    );
    expect(ok.status).toBe(200);
  });

  it('passes the parsed body to update and serves only the progress page otherwise', async () => {
    const auth = { authorization: `Bearer ${TOKEN}` };
    await route(controller, TOKEN, request('POST', '/v1/update', auth, '{"tag":"1.3.0"}'));
    expect(calls).toContain('update {"tag":"1.3.0"}');
    expect((await route(controller, TOKEN, request('GET', '/settings/updates'))).html).toBe(true);
    expect((await route(controller, TOKEN, request('POST', '/anything'))).status).toBe(405);
    expect((await route(controller, TOKEN, request('DELETE', '/v1/status', auth))).status).toBe(
      404,
    );
  });
});
