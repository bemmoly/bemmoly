import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { SqlClient } from '../../clients/postgres.ts';
import type { Actor } from '../../contracts/authz.ts';
import { createReplicatedEventBus } from './event-bus.ts';
import { createRealtimeHub, messageScopes } from './hub.ts';
import { createNotifyPublisher, encodePayload } from './notify.ts';

const logger = pino({ level: 'silent' });
const alice: Actor = { kind: 'user', id: 'alice' };

function fakeSocket() {
  const sent: unknown[] = [];
  return {
    sent,
    socket: { send: (data: string) => void sent.push(JSON.parse(data)), close: vi.fn() },
  };
}

function fakeSql() {
  const calls: unknown[][] = [];
  const sql = (async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push(values);
    return [];
  }) as unknown as SqlClient;
  return { sql, calls };
}

describe('realtime hub', () => {
  it('delivers only to subscribers of the message scope', async () => {
    const hub = createRealtimeHub({ logger });
    const board = fakeSocket();
    const shell = fakeSocket();
    const boardClient = hub.connect(board.socket, alice);
    const shellClient = hub.connect(shell.socket, alice);
    await boardClient.receive(
      JSON.stringify({ type: 'subscribe', scope: { kind: 'project', id: 'p1' } }),
    );
    await shellClient.receive(JSON.stringify({ type: 'subscribe', scope: { kind: 'workspace' } }));
    expect(hub.dispatch({ kind: 'issue.updated', ids: ['i1'], projectId: 'p1' })).toBe(1);
    expect(hub.dispatch({ kind: 'settings.changed', ids: ['workspace.name'] })).toBe(1);
    expect(hub.dispatch({ kind: 'issue.updated', ids: ['i2'], projectId: 'p2' })).toBe(0);
    expect(board.sent).toEqual([
      { type: 'ready' },
      { type: 'subscribed', scope: { kind: 'project', id: 'p1' } },
      { type: 'invalidate', message: { kind: 'issue.updated', ids: ['i1'], projectId: 'p1' } },
    ]);
    expect(shell.sent.at(-1)).toMatchObject({ message: { kind: 'settings.changed' } });
    boardClient.disconnect();
    expect(hub.connections()).toBe(1);
  });

  it('refuses module scopes the actor has no access to, and bad messages', async () => {
    const moduleAccess = {
      modulesFor: vi.fn(async () => new Set<string>()),
      canAccess: vi.fn(async () => false),
    };
    const hub = createRealtimeHub({ logger, moduleAccess });
    const { socket, sent } = fakeSocket();
    const client = hub.connect(socket, alice);
    await client.receive(
      JSON.stringify({ type: 'subscribe', scope: { kind: 'module', id: 'work' } }),
    );
    await client.receive('not json');
    await client.receive(JSON.stringify({ type: 'ping' }));
    expect(sent.slice(1)).toEqual([
      { type: 'error', code: 'module_access_denied', message: 'Not allowed to subscribe' },
      { type: 'error', code: 'bad_request', message: 'Unknown message' },
      { type: 'pong' },
    ]);
    expect(hub.dispatch({ kind: 'x', ids: [], moduleId: 'work' })).toBe(0);
  });

  it('delivers a user-addressed message to that user only, subscribed or not', () => {
    const hub = createRealtimeHub({ logger });
    const mine = fakeSocket();
    const token = fakeSocket();
    const other = fakeSocket();
    hub.connect(mine.socket, alice);
    hub.connect(token.socket, { kind: 'api_token', id: 't1', userId: 'alice' });
    hub.connect(other.socket, { kind: 'user', id: 'bob' });
    expect(hub.dispatch({ kind: 'notifications', ids: ['n1'], userId: 'alice' })).toBe(2);
    expect(other.sent).toEqual([{ type: 'ready' }]);
  });

  it('maps a message to every scope it names, or the workspace', () => {
    expect(messageScopes({ kind: 'k', ids: [], projectId: 'p', moduleId: 'work' })).toEqual([
      'project:p',
      'module:work',
    ]);
    expect(messageScopes({ kind: 'k', ids: [] })).toEqual(['workspace']);
  });
});

describe('NOTIFY payloads', () => {
  it('refuses payloads over the 8 KB NOTIFY limit', () => {
    expect(encodePayload({ a: 1 }, 'x')).toBe('{"a":1}');
    expect(() => encodePayload({ blob: 'x'.repeat(9000) }, 'Big')).toThrow(/under 8 KB/);
  });

  it('publishes a validated message on the realtime channel', async () => {
    const { sql, calls } = fakeSql();
    await createNotifyPublisher(sql).publish({
      kind: 'page.published',
      ids: ['p1'],
      spaceId: 's1',
    });
    expect(calls).toEqual([
      ['bemmoly_events', '{"kind":"page.published","ids":["p1"],"spaceId":"s1"}'],
    ]);
  });
});

describe('replicated event bus', () => {
  it('runs subscribe handlers in process and subscribeEverywhere handlers on receipt', async () => {
    const { sql, calls } = fakeSql();
    const bus = createReplicatedEventBus({ sql, logger });
    const local = vi.fn();
    const everywhere = vi.fn();
    bus.subscribe('page.published', local);
    bus.subscribeEverywhere('page.published', everywhere);
    const occurredAt = new Date('2026-10-01T10:00:00Z');
    await bus.publish({ kind: 'page.published', occurredAt, payload: { id: 'p1' } });
    expect(local).toHaveBeenCalledOnce();
    expect(everywhere).not.toHaveBeenCalled();
    const [, payload] = calls[0] as [string, string];
    await bus.receive(payload);
    expect(everywhere).toHaveBeenCalledWith({
      kind: 'page.published',
      occurredAt,
      payload: { id: 'p1' },
    });
  });
});
