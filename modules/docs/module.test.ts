import { loadModules } from '@bemmoly/core';
import { moduleManifestSchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import docs from './module.ts';

describe('docs module', () => {
  it('loads through the kernel and exposes a valid manifest', () => {
    const registry = loadModules({ available: [docs] });
    const [manifest] = registry.manifests();
    expect(moduleManifestSchema.parse(manifest)).toMatchObject({
      id: 'docs',
      name: 'Docs',
      version: '0.2.0',
      navigation: [
        { id: 'docs.home', label: 'Docs', path: '/docs', placement: 'top' },
        { id: 'docs.create-page', label: 'Page', path: '/docs/create', placement: 'create' },
        {
          id: 'docs.create-space',
          label: 'Space',
          path: '/docs/spaces/new',
          placement: 'create',
        },
      ],
    });
    expect(docs.defaultAccess).toBe('teams');
  });

  it('declares the Docs rows of the roles matrix under its own namespace', () => {
    const registry = loadModules({ available: [docs] });
    const capabilities = registry.capabilities();
    expect(capabilities.map((capability) => capability.name)).toEqual([
      'docs.space.create',
      'docs.space.configure',
      'docs.page.view',
      'docs.page.edit',
      'docs.page.delete',
      'docs.page.publish',
      'docs.space.export',
    ]);
    expect(capabilities.every((capability) => capability.group === 'Docs')).toBe(true);
    const view = capabilities.find((capability) => capability.name === 'docs.page.view');
    expect(Object.values(view?.defaults ?? {}).every(Boolean)).toBe(true);
    const edit = capabilities.find((capability) => capability.name === 'docs.page.edit');
    expect(edit?.defaults.viewer).toBe(false);
    expect(edit?.defaults.contractor).toBe(true);
  });

  it('contributes its settings', () => {
    const registry = loadModules({ available: [docs] });
    const [loaded] = registry.list();
    expect(loaded?.contributions.settings.map((setting) => setting.key)).toEqual([
      'docs.staleAfterDays',
      'docs.compactThreshold',
    ]);
  });
});
