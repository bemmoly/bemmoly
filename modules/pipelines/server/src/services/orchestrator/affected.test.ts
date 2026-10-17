import { describe, expect, it } from 'vitest';
import { matchesFilters, matchesGlob } from '../../utils/glob.ts';
import { affectedApplications } from './affected.ts';

describe('globs', () => {
  it('reads *, ** and alternatives the way people write them', () => {
    expect(matchesGlob('services/api/src/a.ts', 'services/api/**')).toBe(true);
    expect(matchesGlob('services/api', 'services/api/**')).toBe(false);
    expect(matchesGlob('a.test.ts', '**/*.test.ts')).toBe(true);
    expect(matchesGlob('src/deep/a.test.ts', '**/*.test.ts')).toBe(true);
    expect(matchesGlob('src/a.ts', 'src/*.{ts,tsx}')).toBe(true);
    expect(matchesGlob('src/x/a.ts', 'src/*.ts')).toBe(false);
    expect(matchesFilters('docs/readme.md', ['**', '!docs/**'])).toBe(false);
  });
});

describe('affectedApplications', () => {
  const candidates = [
    { key: 'web', path: 'apps/web', paths: [] },
    { key: 'api', path: 'apps/api', paths: ['apps/api/**', 'packages/shared/**', '!**/*.md'] },
    { key: 'root', path: '', paths: [] },
  ];

  it('picks applications by folder or by their path filters', () => {
    expect(affectedApplications(candidates, ['apps/web/src/main.tsx'])).toEqual(['web', 'root']);
    expect(affectedApplications(candidates, ['packages/shared/x.ts'])).toEqual(['api', 'root']);
    expect(affectedApplications(candidates, ['apps/api/README.md'])).toEqual(['root']);
  });

  it('builds everything when the code host did not say what changed', () => {
    expect(affectedApplications(candidates, null)).toEqual(['web', 'api', 'root']);
  });
});
