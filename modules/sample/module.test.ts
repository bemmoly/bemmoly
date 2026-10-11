import { loadModules } from '@bemmoly/core';
import { moduleManifestSchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import sample from './module.ts';

describe('sample module', () => {
  it('loads through the kernel and exposes a valid manifest', () => {
    const registry = loadModules({ available: [sample] });
    const [manifest] = registry.manifests();
    expect(moduleManifestSchema.parse(manifest)).toEqual({
      id: 'sample',
      name: 'Sample',
      version: '0.0.0',
      navigation: [{ id: 'sample', label: 'Sample', path: '/sample', placement: 'top' }],
      icon: 'box',
      color: 'epic-4',
      order: 90,
      sidebar: { path: '/sample', links: [], primary: [] },
    });
    expect(registry.capabilities().map((capability) => capability.name)).toEqual(['sample.view']);
  });

  it('contributes a changeset, a job, a setting and a route through the kernel', () => {
    const registry = loadModules({ available: [sample] });
    const [loaded] = registry.list();
    expect(sample.changelog.map((changeset) => changeset.id)).toEqual(['0001-sample-items']);
    expect(sample.changelog[0]?.source?.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(loaded?.contributions.jobs.map((job) => job.name)).toEqual(['sample.ping']);
    expect(loaded?.contributions.settings.map((setting) => setting.key)).toEqual([
      'sample.greeting',
    ]);
    expect(registry.routes().map((route) => route.prefix)).toEqual(['/sample']);
  });
});
