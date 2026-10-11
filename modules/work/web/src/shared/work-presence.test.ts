import { describe, expect, it } from 'vitest';
import { whereLabel } from './work-presence.tsx';

describe('whereLabel', () => {
  it('says where someone is in the words the tooltip uses', () => {
    expect(whereLabel('board')).toBe('on the board');
    expect(whereLabel('backlog')).toBe('on the backlog');
    expect(whereLabel('issue:PLT-204')).toBe('viewing PLT-204');
    expect(whereLabel('roadmap')).toBe('here');
  });
});
