import { describe, expect, it } from 'vitest';
import type { BemmolyModule } from './contract.ts';
import { ModuleLoadError } from './errors.ts';
import { loadModules } from './loader.ts';

function fakeModule(id: string, overrides: Partial<BemmolyModule> = {}): BemmolyModule {
  return {
    id,
    version: '0.1.0',
    coreApi: '^0.1.0',
    defaultAccess: 'everyone',
    changelog: [],
    register(ctx) {
      ctx.navigation.add({ id, label: id.toUpperCase(), path: `/${id}`, placement: 'top' });
      ctx.capabilities.add({
        name: `${id}.view`,
        label: `View ${id}`,
        group: id,
        defaults: {
          org_admin: true,
          project_admin: true,
          member: true,
          viewer: true,
          contractor: false,
        },
      });
    },
    ...overrides,
  };
}

describe('loadModules', () => {
  it('registers every available module and lists manifests', () => {
    const registry = loadModules({ available: [fakeModule('sample'), fakeModule('docs')] });
    expect(registry.ids()).toEqual(['sample', 'docs']);
    expect(registry.manifests()[0]).toEqual({
      id: 'sample',
      version: '0.1.0',
      navigation: [{ id: 'sample', label: 'SAMPLE', path: '/sample', placement: 'top' }],
    });
    expect(registry.capabilities().map((c) => [c.moduleId, c.name])).toEqual([
      ['sample', 'sample.view'],
      ['docs', 'docs.view'],
    ]);
  });

  it('loads only the enabled set, dependencies first', () => {
    const desk = fakeModule('desk', { dependsOn: ['work'] });
    const registry = loadModules({
      available: [desk, fakeModule('work'), fakeModule('docs')],
      enabled: ['desk', 'work'],
    });
    expect(registry.ids()).toEqual(['work', 'desk']);
  });

  it('fails when a dependency is not enabled', () => {
    const desk = fakeModule('desk', { dependsOn: ['work'] });
    expect(() => loadModules({ available: [desk, fakeModule('work')], enabled: ['desk'] })).toThrow(
      /depends on "work", which is not enabled/,
    );
  });

  it('fails on dependency cycles, unknown ids and incompatible kernels', () => {
    const a = fakeModule('alpha', { dependsOn: ['beta'] });
    const b = fakeModule('beta', { dependsOn: ['alpha'] });
    expect(() => loadModules({ available: [a, b] })).toThrow(/cycle: alpha -> beta -> alpha/);
    expect(() => loadModules({ available: [fakeModule('work')], enabled: ['nope'] })).toThrow(
      ModuleLoadError,
    );
    expect(() => loadModules({ available: [fakeModule('work', { coreApi: '^2.0.0' })] })).toThrow(
      /needs kernel API \^2.0.0/,
    );
  });

  it('rejects contributions outside the module namespace', () => {
    const rogue = fakeModule('work', {
      register(ctx) {
        ctx.capabilities.add({
          name: 'docs.page.publish',
          label: 'Publish',
          group: 'docs',
          defaults: {
            org_admin: true,
            project_admin: true,
            member: true,
            viewer: false,
            contractor: false,
          },
        });
      },
    });
    expect(() => loadModules({ available: [rogue] })).toThrow(
      /must be namespaced as "work.<action>"/,
    );
    const badNav = fakeModule('work', {
      register(ctx) {
        ctx.navigation.add({ id: 'x', label: 'X', path: '/docs', placement: 'top' });
      },
    });
    expect(() => loadModules({ available: [badNav] })).toThrow(/must live under "\/work"/);
  });

  it('rejects two modules claiming the same route prefix', () => {
    const plugin = async () => undefined;
    const withRoute = (id: string) =>
      fakeModule(id, { register: (ctx) => ctx.routes.add({ prefix: '/things', plugin }) });
    expect(() => loadModules({ available: [withRoute('one'), withRoute('two')] })).toThrow(
      /already used by "one"/,
    );
  });

  it('offers the editor registry only when enabled', () => {
    const seen: boolean[] = [];
    const probe = fakeModule('work', {
      register: (ctx) => void seen.push(ctx.editor !== undefined),
    });
    loadModules({ available: [probe] });
    loadModules({ available: [probe], editorEnabled: true });
    expect(seen).toEqual([false, true]);
  });
});
