import type { DomainEvent, RealtimeMessage } from '@bemmoly/core';
import { describe, expect, it } from 'vitest';
import { SPRINT_PULSE_QUIET_SECONDS, withAiTriggers } from './index.ts';

function setup() {
  const sent: RealtimeMessage[] = [];
  const events: DomainEvent[] = [];
  const realtime = withAiTriggers(
    { publish: async (message) => void sent.push(message) },
    { publish: async (event) => void events.push(event), subscribe: () => () => undefined },
  );
  return { sent, events, realtime };
}

describe('the AI triggers on Work changes', () => {
  it('asks for a sprint pulse after the quiet period when a sprint changes', async () => {
    const { sent, events, realtime } = setup();
    await realtime.publish({ kind: 'work.sprint', ids: ['s1'], projectId: 'p1' });
    expect(sent).toEqual([{ kind: 'work.sprint', ids: ['s1'], projectId: 'p1' }]);
    expect(events.map((event) => [event.kind, event.payload])).toEqual([
      [
        'ai.insight.requested',
        { kind: 'sprint_pulse', targetIds: ['s1'], quietSeconds: SPRINT_PULSE_QUIET_SECONDS },
      ],
    ]);
    expect(SPRINT_PULSE_QUIET_SECONDS).toBe(300);
  });

  it('tells other modules an issue changed, and stays quiet for other kinds', async () => {
    const { events, realtime } = setup();
    await realtime.publish({ kind: 'work.issue', ids: ['i1'], projectId: 'p1' });
    await realtime.publish({ kind: 'work.board', ids: ['i1'], projectId: 'p1' });
    await realtime.publish({ kind: 'work.sprint', ids: [], projectId: 'p1' });
    expect(events.map((event) => [event.kind, event.payload])).toEqual([
      ['ai.source.changed', { kind: 'issue', ids: ['i1'] }],
    ]);
  });
});
