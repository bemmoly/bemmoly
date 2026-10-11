import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import type { SystemDependencies } from '../deps.ts';
import { resolveSetSource } from './fetch-set.ts';

/** A folder path needs neither the database nor settings. */
const deps = {} as unknown as SystemDependencies;

describe('backup set source from a folder path', () => {
  it('takes the set name from the folder, with or without trailing slashes', async () => {
    for (const ref of ['/srv/backups/bemmoly-20261008', '/srv/backups/bemmoly-20261008//']) {
      expect((await resolveSetSource(deps, ref)).setName).toBe('bemmoly-20261008');
    }
  });

  it('resolves a path with a long run of slashes in linear time', async () => {
    const ref = `/srv${'/'.repeat(100_000)}bemmoly-20261008`;
    const start = performance.now();
    expect((await resolveSetSource(deps, ref)).setName).toBe('bemmoly-20261008');
    expect(performance.now() - start).toBeLessThan(50);
  });
});
