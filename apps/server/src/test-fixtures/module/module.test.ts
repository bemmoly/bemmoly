import { loadModules } from '@bemmoly/core';
import { moduleManifestSchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import fixture from './module.ts';

describe('the fixture module', () => {
  it('loads through the kernel and exposes a valid manifest', () => {
    const registry = loadModules({ available: [fixture] });
    const [manifest] = registry.manifests();
    expect(moduleManifestSchema.parse(manifest)).toEqual({
      id: 'fixture',
      name: 'Fixture',
      version: '0.0.0',
      navigation: [{ id: 'fixture', label: 'Fixture', path: '/fixture', placement: 'top' }],
      icon: 'box',
      color: 'epic-4',
      order: 90,
      sidebar: { path: '/fixture', links: [], primary: [] },
    });
    expect(registry.capabilities().map((capability) => capability.name)).toEqual(['fixture.view']);
  });

  it('contributes a changeset, a job, a setting and a route through the kernel', () => {
    const registry = loadModules({ available: [fixture] });
    const [loaded] = registry.list();
    expect(fixture.changelog.map((changeset) => changeset.id)).toEqual(['0001-fixture-items']);
    expect(fixture.changelog[0]?.source?.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(loaded?.contributions.jobs.map((job) => job.name)).toEqual(['fixture.ping']);
    expect(loaded?.contributions.settings.map((setting) => setting.key)).toEqual([
      'fixture.greeting',
    ]);
    expect(registry.routes().map((route) => route.prefix)).toEqual(['/fixture']);
  });
});
