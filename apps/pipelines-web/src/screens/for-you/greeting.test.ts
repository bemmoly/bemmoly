import { describe, expect, it } from 'vitest';
import { greetingId, todayLine, weekChange } from './greeting.ts';

describe('the For you greeting', () => {
  it('greets by the hour', () => {
    expect([9, 13, 20].map(greetingId)).toEqual([
      'pipelinesForYou.greeting.morning',
      'pipelinesForYou.greeting.afternoon',
      'pipelinesForYou.greeting.evening',
    ]);
  });

  it('names the day and compares the weeks', () => {
    expect(todayLine(new Date(2026, 10, 3), 'en-GB')).toBe('Tuesday 3 November');
    expect(weekChange(38, 34)).toBe(12);
    expect(weekChange(5, 0)).toBeNull();
  });
});
