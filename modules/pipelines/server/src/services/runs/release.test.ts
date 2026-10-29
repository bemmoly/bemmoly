import { describe, expect, it } from 'vitest';
import { deployConfigOf, repositoryOf, versionOf } from './release.ts';

/* What a passing build's release records: where its image went, and how it deploys. */

describe('a release from a run', () => {
  it('points at the repository the build step pushed to', () => {
    const steps = [
      { env: { BEMMOLY_BUILD_IMAGE: 'europe-west1-docker.pkg.dev/nila-ci/apps/shop' } },
    ];
    expect(repositoryOf(steps, 'shop')).toBe('europe-west1-docker.pkg.dev/nila-ci/apps/shop');
    expect(repositoryOf([{ env: {} }], 'shop')).toBe('bemmoly-local/shop');
    expect(repositoryOf(null, 'shop')).toBe('bemmoly-local/shop');
  });

  it('keeps the deploy settings the run resolved, for one application or many', () => {
    const deploy = { kind: 'container-service', port: '3000', public: true };
    expect(deployConfigOf({ deploy }, 'shop')).toEqual({ deploy });
    expect(
      deployConfigOf(
        { applications: [{ key: 'api', pipeline: { deploy } }, { key: 'web' }] },
        'api',
      ),
    ).toEqual({ deploy });
    expect(deployConfigOf({ applications: [{ key: 'web' }] }, 'web')).toEqual({});
    expect(deployConfigOf(null, 'shop')).toEqual({});
  });

  it('is versioned by its tag, or by its short commit', () => {
    expect(versionOf('refs/tags/v2.0.0', 'a1c9e3f0')).toBe('v2.0.0');
    expect(versionOf('main', 'a1c9e3f0')).toBe('a1c9e3f');
  });
});
