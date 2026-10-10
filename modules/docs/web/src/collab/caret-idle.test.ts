import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARET_NAME_MS, createCaretIdle } from './caret-idle.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('collaborator caret names', () => {
  it('fade after three seconds idle and come back when the person moves', () => {
    const idle = createCaretIdle();
    const label = document.createElement('span');
    idle.attach('u-jonas', label);
    expect(label.hasAttribute('data-idle')).toBe(false);
    vi.advanceTimersByTime(CARET_NAME_MS - 1);
    expect(label.hasAttribute('data-idle')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(label.hasAttribute('data-idle')).toBe(true);
    idle.touch('u-jonas');
    expect(label.hasAttribute('data-idle')).toBe(false);
    vi.advanceTimersByTime(CARET_NAME_MS / 2);
    idle.touch('u-jonas');
    vi.advanceTimersByTime(CARET_NAME_MS / 2);
    expect(label.hasAttribute('data-idle')).toBe(false);
  });

  it('follows the newest label drawn for a person, and stops on destroy', () => {
    const idle = createCaretIdle();
    const first = document.createElement('span');
    const second = document.createElement('span');
    idle.attach('u-priya', first);
    idle.attach('u-priya', second);
    vi.advanceTimersByTime(CARET_NAME_MS);
    expect(second.hasAttribute('data-idle')).toBe(true);
    idle.touch('u-priya');
    idle.destroy();
    vi.advanceTimersByTime(CARET_NAME_MS);
    expect(second.hasAttribute('data-idle')).toBe(false);
  });
});
