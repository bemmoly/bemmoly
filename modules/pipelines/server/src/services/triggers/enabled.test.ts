import { describe, expect, it } from 'vitest';
import { branchMatches, startsOn } from './enabled.ts';

describe('triggers a pipeline starts on', () => {
  it('matches branches exactly or with *', () => {
    expect(branchMatches('main', 'main')).toBe(true);
    expect(branchMatches('main', 'maintenance')).toBe(false);
    expect(branchMatches('release/*', 'release/1.2')).toBe(true);
    expect(branchMatches('*', 'any/branch')).toBe(true);
    expect(branchMatches('v1.(x)', 'v1.(x)')).toBe(true);
  });

  it('starts nothing without a trigger, and only on the triggers added', () => {
    expect(startsOn([], { kind: 'push', branch: 'main' })).toBe(false);
    expect(startsOn(null, { kind: 'pull_request' })).toBe(false);
    const push = [{ kind: 'push', branch: 'main' }];
    expect(startsOn(push, { kind: 'push', branch: 'main' })).toBe(true);
    expect(startsOn(push, { kind: 'push', branch: 'feature' })).toBe(false);
    expect(startsOn(push, { kind: 'pull_request' })).toBe(false);
    expect(startsOn([{ kind: 'pull_request' }], { kind: 'pull_request' })).toBe(true);
    expect(startsOn([{ kind: 'bogus' }], { kind: 'pull_request' })).toBe(false);
  });
});
