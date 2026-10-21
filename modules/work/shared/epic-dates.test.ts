import { describe, expect, it } from 'vitest';
import {
  daysPastEpic,
  extendedEpicEnd,
  isoDayOrNull,
  pulledInside,
  storyEnd,
} from './epic-dates.ts';

describe('a story past its epic', () => {
  it('counts the days its last day runs past the target, and nothing when it fits', () => {
    expect(daysPastEpic({ startAt: null, dueAt: '2026-12-05' }, '2026-12-01')).toBe(4);
    expect(daysPastEpic({ startAt: '2026-12-03', dueAt: null }, '2026-12-01')).toBe(2);
    expect(daysPastEpic({ startAt: null, dueAt: '2026-12-01' }, '2026-12-01')).toBeNull();
    expect(daysPastEpic({ startAt: null, dueAt: '2026-12-05' }, null)).toBeNull();
    expect(daysPastEpic({ startAt: null, dueAt: null }, '2026-12-01')).toBeNull();
  });

  it('extends the epic to the story end, or pulls the story back without passing the target', () => {
    const story = { startAt: '2026-12-03', dueAt: '2026-12-09' };
    expect(storyEnd(story)).toBe('2026-12-09');
    expect(extendedEpicEnd(story)).toBe('2026-12-09');
    expect(pulledInside(story, '2026-12-01')).toEqual({
      startAt: '2026-12-01',
      dueAt: '2026-12-01',
    });
    expect(pulledInside({ startAt: '2026-11-20', dueAt: '2026-12-09' }, '2026-12-01')).toEqual({
      startAt: '2026-11-20',
      dueAt: '2026-12-01',
    });
  });

  it('reads a day only from text that is one', () => {
    expect(isoDayOrNull('2026-12-01')).toBe('2026-12-01');
    expect(isoDayOrNull('2026-12-01T10:00:00Z')).toBe('2026-12-01');
    expect(isoDayOrNull('soon')).toBeNull();
    expect(isoDayOrNull(3)).toBeNull();
  });
});
