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
      version: '0.0.0',
      navigation: [{ id: 'sample', label: 'Sample', path: '/sample', placement: 'top' }],
    });
    expect(registry.capabilities().map((capability) => capability.name)).toEqual(['sample.view']);
  });
});
