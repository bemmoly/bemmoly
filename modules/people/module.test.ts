import { loadModules } from '@bemmoly/core';
import { moduleManifestSchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import people from './module.ts';

describe('people module', () => {
  it('loads through the kernel with its own area in the sidebar', () => {
    const registry = loadModules({ available: [people] });
    const [manifest] = registry.manifests();
    expect(moduleManifestSchema.parse(manifest)).toMatchObject({
      id: 'people',
      name: 'People',
      icon: 'people',
      sidebar: {
        path: '/people',
        links: [
          { id: 'people.directory', path: '/people' },
          { id: 'people.org', path: '/people/org' },
          { id: 'people.time-off', path: '/people/time-off' },
          { id: 'people.journeys', path: '/people/journeys' },
        ],
      },
      settings: { path: '/settings/people', requires: 'people.settings.manage' },
    });
    expect(people.defaultAccess).toBe('everyone');
  });

  it('declares its rows of the roles matrix, org admins only by default', () => {
    const capabilities = loadModules({ available: [people] }).capabilities();
    expect(capabilities.map((capability) => capability.name)).toEqual([
      'people.settings.manage',
      'people.journeys.manage',
      'people.leave.manage',
      'people.profiles.edit',
    ]);
    for (const capability of capabilities) {
      expect(capability.defaults).toMatchObject({ org_admin: true, member: false });
    }
  });

  it('serves its routes under /hr, apart from the kernel’s /people', () => {
    const registry = loadModules({ available: [people] });
    expect(registry.routes().map((route) => route.prefix)).toEqual(['/hr']);
    const [loaded] = registry.list();
    expect(loaded?.contributions.jobs.map((job) => job.name)).toEqual(['people.start-journey']);
  });
});
