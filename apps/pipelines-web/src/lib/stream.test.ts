import { describe, expect, it, vi } from 'vitest';
import { createStream } from './stream.ts';

class FakeSource {
  static opened: FakeSource[] = [];
  closed = false;
  onmessage: ((message: MessageEvent) => void) | null = null;
  readonly listeners = new Map<string, (message: MessageEvent) => void>();
  readonly url: string;
  constructor(url: string) {
    this.url = url;
    FakeSource.opened.push(this);
  }
  addEventListener(kind: string, listener: (message: MessageEvent) => void) {
    this.listeners.set(kind, listener);
  }
  close() {
    this.closed = true;
  }
  emit(kind: string, data: unknown) {
    this.listeners.get(kind)?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

describe('the tab’s one stream', () => {
  it('opens once with every subscriber’s topics and reopens when the set changes', async () => {
    vi.useFakeTimers();
    FakeSource.opened = [];
    const stream = createStream({
      url: (topics) => `/streams?topics=${topics.join(',')}`,
      create: (url) => new FakeSource(url) as unknown as EventSource,
    });
    const counter = vi.fn();
    const map = vi.fn();
    const stopCounter = stream.subscribe(['live'], counter);
    stream.subscribe(['map:commerce', 'live'], map);
    vi.advanceTimersByTime(60);
    expect(FakeSource.opened.map((source) => source.url)).toEqual([
      '/streams?topics=live,map:commerce',
    ]);
    const source = FakeSource.opened[0];
    source?.emit('counter', {
      topic: 'live',
      kind: 'counter',
      at: '2026-10-16T10:00:00.000Z',
      data: { running: 214, queued: 38 },
    });
    expect(counter).toHaveBeenCalledWith(
      expect.objectContaining({ data: { running: 214, queued: 38 } }),
    );
    expect(map).toHaveBeenCalledTimes(1);
    stopCounter();
    vi.advanceTimersByTime(60);
    // "live" is still wanted by the map's subscriber, so nothing reopens.
    expect(FakeSource.opened).toHaveLength(1);
    stream.close();
    expect(source?.closed).toBe(true);
    vi.useRealTimers();
  });

  it('ignores events that are not Pipelines stream events', () => {
    vi.useFakeTimers();
    FakeSource.opened = [];
    const stream = createStream({
      url: () => '/streams',
      create: (url) => new FakeSource(url) as unknown as EventSource,
    });
    const listener = vi.fn();
    stream.subscribe(['live'], listener);
    vi.advanceTimersByTime(60);
    FakeSource.opened[0]?.emit('counter', { topic: 'live', kind: 'counter', data: 'nope' });
    expect(listener).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
