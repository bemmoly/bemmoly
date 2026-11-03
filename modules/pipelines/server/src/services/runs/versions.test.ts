import { describe, expect, it } from 'vitest';
import { bumpOf, legacyVersion, nextSemver } from './versions.ts';

describe('version numbers', () => {
  it('bumps from conventional commit messages', () => {
    expect(bumpOf(['fix: retry on 503'])).toBe('patch');
    expect(bumpOf(['chore: bump vitest', 'feat(offers): counter offers'])).toBe('minor');
    expect(bumpOf(['feat!: drop the v1 API'])).toBe('major');
    expect(bumpOf(['refactor: split\n\nBREAKING CHANGE: config moved'])).toBe('major');
    expect(bumpOf([])).toBe('patch');
  });

  it('counts on from the last semantic version, starting at 0.1.0', () => {
    expect(nextSemver(null, ['feat: first'])).toBe('0.1.0');
    expect(nextSemver('1.7.2', ['fix: x'])).toBe('1.7.3');
    expect(nextSemver('1.7.2', ['feat: x'])).toBe('1.8.0');
    expect(nextSemver('v1.7.2', ['feat!: x'])).toBe('2.0.0');
  });

  it('keeps the older rule when no scheme was chosen', () => {
    expect(legacyVersion('refs/tags/v2.0.0', 'a1c9e3f0')).toBe('v2.0.0');
    expect(legacyVersion('main', 'a1c9e3f0')).toBe('a1c9e3f');
  });
});
