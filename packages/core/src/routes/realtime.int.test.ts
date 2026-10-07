import type { IncomingHttpHeaders } from 'node:http';
import { isBemmolyError } from '@bemmoly/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { createSqlClient, type SqlClient } from '../clients/postgres.ts';
import type { SessionResolver } from '../contracts/session-resolver.ts';
import { loadModules } from '../modules/loader.ts';
import { kernelRoutes } from './index.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../testing/isolated-database.ts';
import { startTestDatabase, type TestDatabase } from '../testing/postgres.ts';
import { createRealtimeService, type RealtimeService } from '../services/realtime/index.ts';

const ORIGIN = 'http://localhost:5173';

/** Stands in for the identity service's resolver: one cookie per person. */
const sessions: SessionResolver = {
  async resolve(headers: IncomingHttpHeaders) {
    const id = /session=(\w+)/.exec(headers.cookie ?? '')?.[1];
    return id
      ? {
          actor: { kind: 'user', id },
          sessionId: `s-${id}`,
          expiresAt: new Date(Date.now() + 60_000),
        }
      : null;
  },
  isAllowedOrigin: (headers) => headers.origin === ORIGIN,
};

function open(url: string, headers: Record<string, string>) {
  const socket = new WebSocket(url, { headers });
  const received: { type: string; message?: { kind: string } }[] = [];
  socket.on('message', (data) => received.push(JSON.parse(String(data))));
  const opened = new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('unexpected-response', (_request, response) =>
      reject(new Error(`upgrade refused with ${response.statusCode}`)),
    );
    socket.once('error', reject);
  });
  return { socket, received, opened };
}

describe('NOTIFY to WebSocket delivery', () => {
  let server: TestDatabase;
  let database: IsolatedDatabase | undefined;
  let sql: SqlClient | undefined;
  let realtime: RealtimeService | undefined;
  let app: FastifyInstance | undefined;
  let url = '';

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    database = await createIsolatedDatabase(server.url);
    sql = createSqlClient(database.url, { maxConnections: 4 });
    realtime = createRealtimeService({ sql, logger: pino({ level: 'silent' }) });
    await realtime.start();
    app = Fastify();
    app.setErrorHandler((error, _request, reply) => {
      const status = isBemmolyError(error) ? (error.code === 'unauthenticated' ? 401 : 403) : 500;
      return reply
        .code(status)
        .send({ code: isBemmolyError(error) ? error.code : 'internal_error' });
    });
    await app.register(
      kernelRoutes({ modules: loadModules({ available: [] }), realtime: realtime.hub, sessions }),
    );
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    url = `${address.replace('http', 'ws')}/ws`;
  });

  afterAll(async () => {
    await realtime?.stop();
    await app?.close();
    await sql?.end({ timeout: 5 });
    await database?.drop();
    if (server.available) await server.stop();
  });

  it('refuses upgrades without a session or from another origin', async (ctx) => {
    if (!app) return ctx.skip(server.available ? 'no app' : server.reason);
    await expect(open(url, { origin: ORIGIN }).opened).rejects.toThrow(/401/);
    await expect(
      open(url, { origin: 'https://evil.example', cookie: 'session=alice' }).opened,
    ).rejects.toThrow(/403/);
  });

  it('forwards NOTIFY messages to matching subscribers and user messages to their owner', async (ctx) => {
    if (!app || !realtime || !sql) return ctx.skip(server.available ? 'no app' : server.reason);
    const alice = open(url, { origin: ORIGIN, cookie: 'session=alice' });
    const bob = open(url, { origin: ORIGIN, cookie: 'session=bob' });
    await Promise.all([alice.opened, bob.opened]);
    alice.socket.send(JSON.stringify({ type: 'subscribe', scope: { kind: 'workspace' } }));
    await expect.poll(() => alice.received.map((m) => m.type)).toEqual(['ready', 'subscribed']);

    await realtime.publisher.publish({ kind: 'settings.changed', ids: ['workspace.name'] });
    await realtime.publisher.publish({ kind: 'notifications', ids: ['n1'], userId: 'bob' });
    await expect
      .poll(() => alice.received.filter((m) => m.type === 'invalidate').map((m) => m.message?.kind))
      .toEqual(['settings.changed']);
    await expect
      .poll(() => bob.received.filter((m) => m.type === 'invalidate').map((m) => m.message?.kind))
      .toEqual(['notifications']);

    await sql
      .begin(async (tx) => {
        await realtime!.publisher.publish({ kind: 'rolled.back', ids: [] }, { transaction: tx });
        throw new Error('rollback');
      })
      .catch(() => undefined);
    await realtime.publisher.publish({ kind: 'after.rollback', ids: [] });
    await expect
      .poll(() => alice.received.filter((m) => m.type === 'invalidate').map((m) => m.message?.kind))
      .toEqual(['settings.changed', 'after.rollback']);
    alice.socket.close();
    bob.socket.close();
  });
});
