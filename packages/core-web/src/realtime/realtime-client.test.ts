import { describe, expect, it, vi } from 'vitest';
import { backoffDelay, RealtimeClient, type RealtimeClientOptions } from './realtime-client.ts';

class FakeSocket extends EventTarget {
  sent: string[] = [];
  closed = false;
  readyState = 0;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }
  message(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
  drop() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
}

function harness(options: Partial<RealtimeClientOptions> = {}) {
  const sockets: FakeSocket[] = [];
  const timers: Array<{ callback: () => void; ms: number }> = [];
  const onEvent = vi.fn();
  const client = new RealtimeClient({
    url: 'ws://bemmoly.test/ws',
    scopes: [{ kind: 'workspace' }],
    onEvent,
    ...options,
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    setTimer: (callback, ms) => timers.push({ callback, ms }),
    clearTimer: () => undefined,
  });
  return { client, sockets, timers, onEvent };
}

describe('backoffDelay', () => {
  it('doubles from the initial delay, jitters, and caps', () => {
    const options = { initialMs: 500, maxMs: 30_000 };
    expect(backoffDelay(0, options, () => 1)).toBe(500);
    expect(backoffDelay(3, options, () => 1)).toBe(4000);
    expect(backoffDelay(3, options, () => 0)).toBe(2000);
    expect(backoffDelay(20, options, () => 1)).toBe(30_000);
  });
});

describe('RealtimeClient', () => {
  it('subscribes to its scopes when the socket opens and forwards events', () => {
    const { client, sockets, onEvent } = harness();
    client.start();
    sockets[0]?.open();
    expect(JSON.parse(sockets[0]?.sent[0] ?? '')).toEqual({
      type: 'subscribe',
      scope: { kind: 'workspace' },
    });
    sockets[0]?.message({
      type: 'invalidate',
      message: { kind: 'notifications', ids: ['n1'], userId: 'u1' },
    });
    sockets[0]?.message({ type: 'subscribed', scope: { kind: 'workspace' } });
    sockets[0]?.message({ nonsense: true });
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent.mock.calls[0]?.[0]).toMatchObject({ kind: 'notifications', userId: 'u1' });
  });

  it('reconnects with growing delays and resets after a successful open', () => {
    const { client, sockets, timers } = harness();
    client.start();
    sockets[0]?.drop();
    expect(timers).toHaveLength(1);
    timers[0]?.callback();
    sockets[1]?.drop();
    expect(timers[1]?.ms ?? 0).toBeGreaterThanOrEqual(timers[0]?.ms ?? 0);
    timers[1]?.callback();
    sockets[2]?.open();
    sockets[2]?.drop();
    expect(timers[2]?.ms ?? Infinity).toBeLessThanOrEqual(500);
  });

  it('stops for good: no reconnect after stop', () => {
    const { client, sockets, timers } = harness();
    client.start();
    client.stop();
    expect(sockets[0]?.closed).toBe(true);
    sockets[0]?.drop();
    expect(timers).toHaveLength(0);
  });
});

describe('RealtimeClient presence', () => {
  const project = { kind: 'project', id: 'p1' } as const;
  const sent = (socket: FakeSocket | undefined) =>
    (socket?.sent ?? []).map((raw) => JSON.parse(raw) as Record<string, unknown>);

  it('joins on every open, so a reconnect puts the tab back', () => {
    const onPresence = vi.fn();
    const { client, sockets, timers } = harness({
      scopes: [],
      presence: { scope: project, view: 'board' },
      onPresence,
    });
    client.start();
    sockets[0]?.open();
    expect(sent(sockets[0])).toEqual([{ type: 'presence', scope: project, view: 'board' }]);
    const people = [{ userId: 'u2', view: 'board', since: '2026-10-10T09:00:00.000Z' }];
    sockets[0]?.message({ type: 'presence', scope: project, people });
    expect(onPresence).toHaveBeenCalledWith(people);
    sockets[0]?.drop();
    timers[0]?.callback();
    sockets[1]?.open();
    expect(sent(sockets[1])).toEqual([{ type: 'presence', scope: project, view: 'board' }]);
  });

  it('moves and leaves without reconnecting, and only says so when it changed', () => {
    const { client, sockets } = harness({ scopes: [] });
    client.present({ scope: project, view: 'board' });
    client.start();
    sockets[0]?.open();
    client.present({ scope: project, view: 'board' });
    client.present({ scope: project, view: 'issue:PLT-204' });
    client.present(null);
    client.present(null);
    expect(sent(sockets[0])).toEqual([
      { type: 'presence', scope: project, view: 'board' },
      { type: 'presence', scope: project, view: 'issue:PLT-204' },
      { type: 'leave' },
    ]);
    expect(sockets).toHaveLength(1);
  });
});
