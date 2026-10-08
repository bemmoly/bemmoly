import { describe, expect, it } from 'vitest';
import manifest from '../../package.json' with { type: 'json' };
import { appVersionOf, PACKAGE_VERSION } from './version.ts';

describe('the version this process reports', () => {
  it('is the named release when the image sets one', () => {
    expect(appVersionOf({ BEMMOLY_VERSION: '0.1.3' })).toBe('0.1.3');
  });

  it('falls back to the package version, which every workspace package shares', () => {
    expect(appVersionOf({})).toBe(manifest.version);
    expect(PACKAGE_VERSION).toBe(manifest.version);
    // A release number, never a literal: the version commit changes it on every release.
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+(-beta\.\d+)?$/);
  });
});
