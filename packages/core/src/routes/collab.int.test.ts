import type { IncomingHttpHeaders } from 'node:http';
import { isBemmolyError } from '@bemmoly/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { applyUpdate, Doc, mergeUpdates } from 'yjs';
import type { Actor } from '../contracts/authz.ts';
import type { SessionResolver } from '../contracts/session-resolver.ts';
import type { CollabAccess, CollabChange } from '../modules/collab.ts';
import { loadModules } from '../modules/loader.ts';
import type { RequestAuthorization } from '../services/authz/index.ts';
import { createCollabHost, type CollabHost } from '../services/collab/index.ts';
import { connectCollabClient, eventually, type CollabTestClient } from '../testing/index.ts';
import { kernelRoutes } from './index.ts';

const ORIGIN = 'http://localhost:5173';
const NOTE = 'test.note:0193a1b2-0000-7000-8000-000000000001';

/** One cookie per person, as the identity service's resolver would answer. */
const sessions: SessionResolver = {
  async resolve(headers: IncomingHttpHeaders) {
    const id = /session=(\w+)/.exec(headers.cookie ?? '')?.[1];
    return id
      ? { actor: { kind: 'user', id }, sessionId: `s-${id}`, expiresAt: new Date(Date.now() + 1e5) }
      : null;
  },
  isAllowedOrigin: (headers) => headers.origin === ORIGIN,
};

const ACCESS: Record<string, CollabAccess> = { alice: 'write', bob: 'write', rita: 'read' };

const stored: { update: Uint8Array; actor: string | null }[] = [];
const changes: { id: string; text: string; editors: string[] }[] = [];

const textOf = (doc: Doc) => doc.getText('body').toString();

function storedDoc(): Doc {
  const doc = new Doc();
  if (stored.length > 0) applyUpdate(doc, mergeUpdates(stored.map((row) => row.update)));
  return doc;
}

const as = (id: string) => ({ cookie: `session=${id}`, origin: ORIGIN });

describe('/collab', () => {
  let app: FastifyInstance;
  let host: CollabHost;
  let url = '';
  const clients: CollabTestClient[] = [];
  const connect = (id: string, name = NOTE) => {
    const client = connectCollabClient({ url, name, headers: as(id) });
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    host = createCollabHost({
      documents: () => [
        {
          moduleId: 'test',
          kind: 'test.note',
          authorize: async (ctx) => ACCESS[ctx.actor.id] ?? 'deny',
          load: async () => (stored.length ? mergeUpdates(stored.map((row) => row.update)) : null),
          store: async (_id, update, actor) =>
            void stored.push({ update, actor: actor?.id ?? null }),
          onChange: async ({ id, doc, editors }: CollabChange) =>
            void changes.push({ id, text: textOf(doc), editors: editors.map((e) => e.id) }),
        },
      ],
      contextFor: (actor: Actor) => ({
        actor,
        authz: {
          canAccess: async () => actor.id !== 'outsider',
        } as unknown as RequestAuthorization,
      }),
      logger: pino({ level: 'silent' }),
      limits: { maxMessageBytes: 64 * 1024 },
      changeDebounceMs: 50,
      maxChangeDebounceMs: 200,
    });
    app = Fastify();
    app.setErrorHandler((error, _request, reply) => {
      const status = isBemmolyError(error) ? (error.code === 'unauthenticated' ? 401 : 403) : 500;
      return reply.code(status).send({ code: isBemmolyError(error) ? error.code : 'internal' });
    });
    await app.register(
      kernelRoutes({ modules: loadModules({ available: [] }), sessions, collab: host }),
    );
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    url = `${address.replace('http', 'ws')}/collab`;
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.destroy();
  });

  afterAll(async () => {
    await host.stop();
    await app.close();
  });

  async function upgradeStatus(headers: Record<string, string>): Promise<number> {
    const socket = new WebSocket(url, { headers });
    return new Promise((resolve, reject) => {
      socket.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0));
      socket.once('open', () => reject(new Error('the upgrade was accepted')));
      socket.once('error', () => undefined);
    });
  }

  it('refuses signed-out and cross-site upgrades before opening a socket', async () => {
    expect(await upgradeStatus({ origin: ORIGIN })).toBe(401);
    expect(await upgradeStatus({ cookie: 'session=alice', origin: 'https://evil.example' })).toBe(
      403,
    );
  });

  it('refuses documents the person may not open, or whose module they cannot use', async () => {
    expect(await connect('mallory').refused).toBe('forbidden');
    expect(await connect('outsider').refused).toBe('module_access_denied');
    expect(await connect('alice', 'test.unknown:abc').refused).toBe('not_found');
  });

  it('converges two writers and stores their updates in order', async () => {
    const alice = connect('alice');
    const bob = connect('bob');
    await Promise.all([alice.synced, bob.synced]);
    expect(await alice.authenticated).toBe('read-write');
    alice.doc.getText('body').insert(0, 'Hello ');
    bob.doc.getText('body').insert(0, 'world');
    await eventually(() => textOf(alice.doc).length === 11 && textOf(bob.doc).length === 11);
    expect(textOf(alice.doc)).toBe(textOf(bob.doc));
    await eventually(() => textOf(storedDoc()) === textOf(alice.doc));
    expect(new Set(stored.map((row) => row.actor))).toEqual(new Set(['alice', 'bob']));
    await eventually(() => changes.some((change) => change.text === textOf(alice.doc)));
    const last = changes.at(-1)!;
    expect(last.editors.sort()).toEqual(['alice', 'bob']);
  });

  it('sends updates to read-only people and drops their writes', async () => {
    const alice = connect('alice');
    const rita = connect('rita');
    await Promise.all([alice.synced, rita.synced]);
    expect(await rita.authenticated).toBe('readonly');
    alice.doc.getText('body').insert(0, '[draft] ');
    await eventually(() => textOf(rita.doc).startsWith('[draft] '));
    const rows = stored.length;
    rita.doc.getText('body').insert(0, 'VANDAL ');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(textOf(alice.doc)).not.toContain('VANDAL');
    expect(stored.slice(rows).some((row) => row.actor === 'rita')).toBe(false);
  });

  it('closes a socket that sends a message over the size limit', async () => {
    const alice = connect('alice');
    await alice.synced;
    alice.doc.getText('body').insert(0, 'x'.repeat(100 * 1024));
    expect(await alice.closed).toBe(1009);
    expect(textOf(storedDoc())).not.toContain('x'.repeat(1024));
  });

  it('changes a document from the server and stores the change', async () => {
    const alice = connect('alice');
    await alice.synced;
    await host.transact(NOTE, (doc) => doc.getText('body').insert(0, '>> '), null);
    await eventually(() => textOf(alice.doc).startsWith('>> '));
    expect(stored.at(-1)?.actor).toBeNull();
  });
});
