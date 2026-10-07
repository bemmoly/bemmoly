import { describe, expect, it, vi } from 'vitest';
import { backoffDelay, RealtimeClient } from './realtime-client.ts';

class FakeSocket extends EventTarget {
  sent: string[] = [];
  closed = false;
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.dispatchEvent(new Event('open'));
  }
  message(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
  drop() {
    this.dispatchEvent(new Event('close'));
  }
}

function harness() {
  const sockets: FakeSocket[] = [];
  const timers: Array<{ callback: () => void; ms: number }> = [];
  const onEvent = vi.fn();
  const client = new RealtimeClient({
    url: 'ws://bemmoly.test/ws',
    scopes: [{ kind: 'workspace' }],
    onEvent,
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
