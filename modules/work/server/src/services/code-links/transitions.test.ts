import { describe, expect, it } from 'vitest';
import { triggerOf } from './transitions.ts';

describe('when a pull request moves its issue', () => {
  it('opens on creation, reopening and leaving draft', () => {
    expect(triggerOf(null, 'open')).toBe('pull_request_opened');
    expect(triggerOf('closed', 'open')).toBe('pull_request_opened');
    expect(triggerOf('draft', 'open')).toBe('pull_request_opened');
  });

  it('merges once', () => {
    expect(triggerOf('open', 'merged')).toBe('pull_request_merged');
    expect(triggerOf(null, 'merged')).toBe('pull_request_merged');
    expect(triggerOf('merged', 'merged')).toBeNull();
  });

  it('moves nothing for drafts, closes or a redelivery of the same state', () => {
    expect(triggerOf(null, 'draft')).toBeNull();
    expect(triggerOf('open', 'closed')).toBeNull();
    expect(triggerOf('open', 'open')).toBeNull();
    expect(triggerOf('open', 'draft')).toBeNull();
  });
});
