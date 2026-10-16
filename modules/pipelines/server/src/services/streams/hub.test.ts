import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '../../../../shared/streams.ts';
import { createStreamHub } from './hub.ts';

const RUN = 'run:01a145e5-f78f-7a23-bdff-ed9b5efa8df3';

describe('stream hub', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function subscriber(topics: string[], userId: string | null = 'u1') {
    const events: StreamEvent[] = [];
    return { topics, userId, events, send: (event: StreamEvent) => void events.push(event) };
  }

  it('sends the first event at once, then at most one per topic and kind each second', () => {
    const hub = createStreamHub({ now: () => Date.now() });
    const viewer = subscriber(['live']);
    hub.subscribe(viewer);
    hub.dispatch({ topic: 'live', kind: 'counter', data: { running: 1, queued: 0 } });
    vi.advanceTimersByTime(0);
    expect(viewer.events.map((event) => event.data)).toEqual([{ running: 1, queued: 0 }]);
    for (let running = 2; running <= 50; running += 1) {
      hub.dispatch({ topic: 'live', kind: 'counter', data: { running, queued: 0 } });
    }
    vi.advanceTimersByTime(999);
    expect(viewer.events).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(viewer.events.map((event) => event.data)).toEqual([
      { running: 1, queued: 0 },
      { running: 50, queued: 0 },
    ]);
  });

  it('keeps the latest of each kind on a topic, so a run update is not lost to a job update', () => {
    const hub = createStreamHub();
    const viewer = subscriber([RUN]);
    hub.subscribe(viewer);
    hub.dispatch({ topic: RUN, kind: 'run.updated', data: { id: 'a', state: 'running' } });
    hub.dispatch({ topic: RUN, kind: 'job.updated', data: { id: 'b', state: 'passed' } });
    vi.advanceTimersByTime(0);
    expect(viewer.events.map((event) => event.kind)).toEqual(['run.updated', 'job.updated']);
  });

  it('sends a person’s for-you events to that person only', () => {
    const hub = createStreamHub();
    const priya = subscriber(['for-you'], 'priya');
    const jon = subscriber(['for-you'], 'jon');
    hub.subscribe(priya);
    hub.subscribe(jon);
    hub.dispatch({ topic: 'for-you', kind: 'for-you.changed', userId: 'priya', data: {} });
    vi.advanceTimersByTime(0);
    expect(priya.events).toHaveLength(1);
    expect(jon.events).toHaveLength(0);
  });

  it('drops events nobody watches and forgets a topic when its last stream closes', () => {
    const listen = vi.fn(async () => async () => undefined);
    const hub = createStreamHub({ listen });
    hub.dispatch({ topic: 'live', kind: 'counter', data: { running: 1, queued: 0 } });
    const viewer = subscriber(['live', 'capacity']);
    const close = hub.subscribe(viewer);
    expect(listen).toHaveBeenCalledOnce();
    expect(hub.size()).toBe(1);
    close();
    expect(hub.size()).toBe(0);
    hub.dispatch({ topic: 'live', kind: 'counter', data: { running: 2, queued: 0 } });
    vi.advanceTimersByTime(1000);
    expect(viewer.events).toEqual([]);
  });
});
