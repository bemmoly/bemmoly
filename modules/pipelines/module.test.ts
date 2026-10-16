import { loadModules } from '@bemmoly/core';
import { moduleManifestSchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import pipelines from './module.ts';

describe('pipelines module', () => {
  it('loads as a product surface that adds nothing to Bemmoly’s frame', () => {
    const registry = loadModules({ available: [pipelines] });
    const [manifest] = registry.manifests();
    expect(moduleManifestSchema.parse(manifest)).toEqual({
      id: 'pipelines',
      name: 'Pipelines',
      version: '0.1.0',
      navigation: [],
      icon: 'rocket',
      color: 'accent',
      order: 90,
      surface: 'product',
    });
  });

  it('declares its capabilities under its own id and mounts its routes under /pipelines', () => {
    const registry = loadModules({ available: [pipelines] });
    expect(registry.capabilities().map((capability) => capability.name)).toEqual([
      'pipelines.view',
      'pipelines.run',
      'pipelines.deploy',
      'pipelines.approve',
      'pipelines.manage',
      'pipelines.platform.admin',
      'pipelines.audit',
    ]);
    expect(registry.routes().map((route) => route.prefix)).toEqual(['/pipelines']);
  });

  it('keeps every table it owns behind its prefix', () => {
    const ids = pipelines.changelog.map((changeset) => changeset.id);
    expect(ids.every((id) => id.startsWith('00') && id.includes('-pipelines-'))).toBe(true);
  });
});
