import { describe, expect, it } from 'vitest';
import { imageTags, parseRelease, previousRelease } from './version.ts';

describe('release versions', () => {
  it('reads stable and beta versions, with or without the v', () => {
    expect(parseRelease('v0.1.0')).toEqual({
      version: '0.1.0',
      tag: 'v0.1.0',
      channel: 'stable',
      prerelease: false,
      minor: '0.1',
    });
    expect(parseRelease('0.2.0-beta.3')).toMatchObject({ channel: 'beta', prerelease: true });
  });

  it.each(['0.1', '0.1.0-rc.1', 'v1.0.0-alpha', '1.0.0+build', 'foundation'])(
    'rejects %s, which AGENTS.md does not allow',
    (version) => {
      expect(() => parseRelease(version)).toThrow(/not a release version/);
    },
  );

  it('tags stable images with the version, the minor and latest, and betas with beta', () => {
    expect(imageTags('ghcr.io/bemmoly/bemmoly', parseRelease('0.3.1'))).toEqual([
      'ghcr.io/bemmoly/bemmoly:0.3.1',
      'ghcr.io/bemmoly/bemmoly:0.3',
      'ghcr.io/bemmoly/bemmoly:latest',
    ]);
    expect(imageTags('ghcr.io/bemmoly/updater', parseRelease('0.4.0-beta.1'))).toEqual([
      'ghcr.io/bemmoly/updater:0.4.0-beta.1',
      'ghcr.io/bemmoly/updater:beta',
    ]);
  });

  it('finds the previous release: stable skips betas, betas take whatever came last', () => {
    const tags = ['v0.1.0', 'v0.1.1', 'v0.2.0-beta.0', 'v0.2.0-beta.1', 'v0.2.0', 'not-a-tag'];
    expect(previousRelease(parseRelease('0.2.0'), tags)?.tag).toBe('v0.1.1');
    expect(previousRelease(parseRelease('0.2.0-beta.1'), tags)?.tag).toBe('v0.2.0-beta.0');
    expect(previousRelease(parseRelease('0.2.0-beta.0'), tags)?.tag).toBe('v0.1.1');
    expect(previousRelease(parseRelease('0.2.1'), tags)?.tag).toBe('v0.2.0');
    expect(previousRelease(parseRelease('0.1.0'), tags)).toBeUndefined();
  });
});
