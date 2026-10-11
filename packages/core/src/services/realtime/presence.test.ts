import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../contracts/authz.ts';
import { createRealtimeHub, type RealtimeHubOptions } from './hub.ts';
import { PRESENCE_RATE } from './presence.ts';

const logger = pino({ level: 'silent' });
const alice: Actor = { kind: 'user', id: 'alice' };
const bob: Actor = { kind: 'user', id: 'bob' };
const project = { kind: 'project', id: 'p1' } as const;

function fakeSocket() {
  const sent: Array<Record<string, unknown>> = [];
  return {
    sent,
    socket: { send: (data: string) => void sent.push(JSON.parse(data)), close: vi.fn() },
    /** The people in the last presence list this socket heard. */
    present: () => sent.filter((message) => message.type === 'presence').at(-1)?.people,
  };
}

/**
 * A hub on a clock that moves half a second per reading. A join reads it twice (the rate,
 * then the arrival), so the n-th join arrives at 09:00:0n.
 */
function harness(options: Partial<RealtimeHubOptions> = {}) {
  let tick = Date.parse('2026-10-10T09:00:00Z');
  const hub = createRealtimeHub({ logger, now: () => new Date((tick += 500)), ...options });
  const open = (actor: Actor) => {
    const socket = fakeSocket();
    return { ...socket, client: hub.connect(socket.socket, actor) };
  };
  return { hub, open };
}

const here = (view: string) => JSON.stringify({ type: 'presence', scope: project, view });

describe('realtime presence', () => {
  it('tells everyone in a scope who else is there, and never themselves', async () => {
    const { open } = harness();
    const a = open(alice);
    const b = open(bob);
    await a.client.receive(here('board'));
    expect(a.present()).toEqual([]);
    await b.client.receive(here('issue:PLT-204'));
    expect(a.present()).toEqual([
      { userId: 'bob', view: 'issue:PLT-204', since: '2026-10-10T09:00:02.000Z' },
    ]);
    expect(b.present()).toEqual([
      { userId: 'alice', view: 'board', since: '2026-10-10T09:00:01.000Z' },
    ]);
  });

  it('follows a move, a leave and a closed socket', async () => {
    const { open } = harness();
    const a = open(alice);
    const b = open(bob);
    await a.client.receive(here('board'));
    await b.client.receive(here('board'));
    await b.client.receive(here('backlog'));
    expect(a.present()).toMatchObject([{ userId: 'bob', view: 'backlog' }]);
    await b.client.receive(JSON.stringify({ type: 'leave' }));
    expect(a.present()).toEqual([]);
    await b.client.receive(here('board'));
    expect(a.present()).toHaveLength(1);
    b.client.disconnect();
    expect(a.present()).toEqual([]);
  });

  it('shows one face per person and view, however many tabs they have', async () => {
    const { open } = harness();
    const a = open(alice);
    const b1 = open(bob);
    const b2 = open(bob);
    const b3 = open(bob);
    await a.client.receive(here('board'));
    await b1.client.receive(here('board'));
    await b2.client.receive(here('board'));
    await b3.client.receive(here('issue:PLT-7'));
    expect(a.present()).toEqual([
      { userId: 'bob', view: 'board', since: '2026-10-10T09:00:02.000Z' },
      { userId: 'bob', view: 'issue:PLT-7', since: '2026-10-10T09:00:04.000Z' },
    ]);
    // Bob's other tabs never list Bob.
    expect(b2.present()).toEqual([
      { userId: 'alice', view: 'board', since: '2026-10-10T09:00:01.000Z' },
    ]);
  });

  it('moving to another scope leaves the first one', async () => {
    const { open } = harness();
    const a = open(alice);
    const b = open(bob);
    await a.client.receive(here('board'));
    await b.client.receive(here('board'));
    await b.client.receive(
      JSON.stringify({ type: 'presence', scope: { kind: 'project', id: 'p2' }, view: 'board' }),
    );
    expect(a.present()).toEqual([]);
    expect(b.present()).toEqual([]);
  });

  it('refuses scopes the person may not subscribe to, and tells nobody', async () => {
    const authorizeSubscription = vi.fn(async (actor: Actor) => actor !== bob);
    const { open } = harness({ authorizeSubscription });
    const a = open(alice);
    const b = open(bob);
    await a.client.receive(here('board'));
    await b.client.receive(here('board'));
    expect(b.sent.at(-1)).toEqual({
      type: 'error',
      code: 'forbidden',
      message: 'Not allowed to join',
    });
    expect(a.present()).toEqual([]);
    expect(authorizeSubscription).toHaveBeenCalledWith(bob, project);
  });

  it('refuses free-text views and joins over the rate', async () => {
    const { open } = harness({ now: () => new Date('2026-10-10T09:00:00Z') });
    const a = open(alice);
    await a.client.receive(JSON.stringify({ type: 'presence', scope: project, view: 'My board!' }));
    expect(a.sent.at(-1)).toMatchObject({ type: 'error', code: 'bad_request' });
    for (let turn = 0; turn < PRESENCE_RATE.max; turn += 1)
      await a.client.receive(here(turn % 2 ? 'board' : 'backlog'));
    await a.client.receive(here('issue:PLT-1'));
    expect(a.sent.at(-1)).toEqual({
      type: 'error',
      code: 'rate_limited',
      message: 'Too many presence updates',
    });
  });

  it('leaves no ghost when the socket closes or moves on during the check', async () => {
    let release: (allowed: boolean) => void = () => undefined;
    const authorizeSubscription = vi.fn(
      (actor: Actor) =>
        new Promise<boolean>((resolve) => {
          if (actor === bob) release = resolve;
          else resolve(true);
        }),
    );
    const { open } = harness({ authorizeSubscription });
    const a = open(alice);
    await a.client.receive(here('board'));
    const b = open(bob);
    const pending = b.client.receive(here('board'));
    b.client.disconnect();
    release(true);
    await pending;
    expect(a.present()).toEqual([]);
    expect(a.sent.filter((message) => message.type === 'presence')).toHaveLength(1);
  });

  it('counts an API token as the person it acts for, and drops presence on shutdown', async () => {
    const { hub, open } = harness();
    const a = open(alice);
    const token = open({ kind: 'api_token', id: 't1', userId: 'bob' });
    await a.client.receive(here('board'));
    await token.client.receive(here('board'));
    expect(a.present()).toMatchObject([{ userId: 'bob' }]);
    hub.closeAll();
    expect(a.socket.close).toHaveBeenCalledWith(1001, 'server shutting down');
  });
});
