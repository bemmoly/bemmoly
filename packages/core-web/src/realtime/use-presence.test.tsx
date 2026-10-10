import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AWAY_AFTER_MS, useRealtimePresence } from './use-presence.ts';

class FakeSocket extends EventTarget {
  static all: FakeSocket[] = [];
  sent: Array<Record<string, unknown>> = [];
  readyState = 0;
  constructor() {
    super();
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }
  hear(data: unknown) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
  drop() {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
}

const project = { kind: 'project', id: 'p1' } as const;
const since = '2026-10-10T09:00:00.000Z';
const people = [
  { userId: 'priya', view: 'board', since },
  { userId: 'aisha', view: 'issue:PLT-204', since },
];

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  setVisibility('visible');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useRealtimePresence', () => {
  it('returns the others on the same view and follows the view without reconnecting', () => {
    const { result, rerender } = renderHook(
      ({ view }) => useRealtimePresence({ url: 'ws://bemmoly.test/ws', scope: project, view }),
      { initialProps: { view: 'board' } },
    );
    const socket = FakeSocket.all[0];
    act(() => socket?.open());
    act(() => socket?.hear({ type: 'presence', scope: project, people }));
    expect(result.current.map((person) => person.userId)).toEqual(['priya']);
    rerender({ view: 'issue:PLT-204' });
    expect(result.current.map((person) => person.userId)).toEqual(['aisha']);
    expect(FakeSocket.all).toHaveLength(1);
    expect(socket?.sent.at(-1)).toEqual({
      type: 'presence',
      scope: project,
      view: 'issue:PLT-204',
    });
  });

  it('shows nobody while the socket is down, and joins nothing without a scope', () => {
    const { result } = renderHook(() =>
      useRealtimePresence({ url: 'ws://bemmoly.test/ws', scope: project, view: 'board' }),
    );
    act(() => FakeSocket.all[0]?.open());
    act(() => FakeSocket.all[0]?.hear({ type: 'presence', scope: project, people }));
    expect(result.current).toHaveLength(1);
    act(() => FakeSocket.all[0]?.drop());
    expect(result.current).toEqual([]);
    cleanup();
    FakeSocket.all = [];
    renderHook(() => useRealtimePresence({ url: 'ws://x/ws', scope: null, view: 'board' }));
    expect(FakeSocket.all).toHaveLength(0);
  });

  it('leaves after the tab has been hidden a while, and comes back when looked at', () => {
    vi.useFakeTimers();
    renderHook(() =>
      useRealtimePresence({ url: 'ws://bemmoly.test/ws', scope: project, view: 'board' }),
    );
    const socket = FakeSocket.all[0];
    act(() => socket?.open());
    act(() => setVisibility('hidden'));
    act(() => vi.advanceTimersByTime(AWAY_AFTER_MS - 1));
    expect(socket?.sent.at(-1)).toMatchObject({ type: 'presence' });
    act(() => vi.advanceTimersByTime(1));
    expect(socket?.sent.at(-1)).toEqual({ type: 'leave' });
    act(() => setVisibility('visible'));
    expect(socket?.sent.at(-1)).toEqual({ type: 'presence', scope: project, view: 'board' });
  });
});
