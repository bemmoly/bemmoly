import { describe, expect, it } from 'vitest';
import type { RequestContext } from '../services/authz/index.ts';
import type { BemmolyModule, ModuleContext } from './contract.ts';
import { loadModules } from './loader.ts';

function moduleNamed(id: string, register: (ctx: ModuleContext) => void): BemmolyModule {
  return {
    id,
    version: '0.1.0',
    coreApi: '^0.1.0',
    defaultAccess: 'everyone',
    changelog: [],
    register,
  };
}

const asPerson = (id: string) => ({ actor: { kind: 'user', id } }) as unknown as RequestContext;

describe('cross-module references', () => {
  let tracker: ModuleContext | undefined;
  let notes: ModuleContext | undefined;
  const issues = moduleNamed('tracker', (ctx) => {
    tracker = ctx;
    ctx.entities.add({
      kind: 'issue',
      renderer: 'issue',
      resolve: async (ref) =>
        'key' in ref && ref.key === 'PLT-1'
          ? { kind: 'issue', id: 'i-1', key: 'PLT-1', title: 'Fix login', path: '/t/PLT-1' }
          : null,
      canView: async (ctx) => ctx.actor.kind === 'user' && ctx.actor.id === 'ada',
    });
  });
  const pages = moduleNamed('notes', (ctx) => {
    notes = ctx;
    ctx.links.addReferenceSource({
      kind: 'notes.page',
      label: 'Linked notes',
      referencesTo: async (_ctx, target) =>
        target.id === 'i-1' ? [{ kind: 'page', id: 'p-1', title: 'Spec', path: '/n/p-1' }] : [],
    });
  });

  it('resolves another module’s record by key, trusted or as a person', async () => {
    loadModules({ available: [pages, issues] });
    expect(await notes!.entities.resolve('issue', { key: 'PLT-1' })).toMatchObject({ id: 'i-1' });
    expect(await notes!.entities.resolve('issue', { key: 'PLT-1' }, asPerson('ada'))).toMatchObject(
      { title: 'Fix login' },
    );
    expect(await notes!.entities.resolve('issue', { key: 'PLT-1' }, asPerson('mo'))).toBeNull();
    expect(await notes!.entities.resolve('issue', { key: 'NOPE-9' })).toBeNull();
    expect(await notes!.entities.resolve('ticket', { id: 'x' })).toBeNull();
  });

  it('asks every module that points at a record, without either importing the other', async () => {
    loadModules({ available: [issues, pages] });
    expect(
      await tracker!.links.referencesTo(asPerson('ada'), { kind: 'issue', id: 'i-1' }),
    ).toEqual([
      {
        source: 'notes.page',
        label: 'Linked notes',
        moduleId: 'notes',
        items: [{ kind: 'page', id: 'p-1', title: 'Spec', path: '/n/p-1' }],
      },
    ]);
    expect(
      await tracker!.links.referencesTo(asPerson('ada'), { kind: 'issue', id: 'i-2' }),
    ).toEqual([]);
  });

  it('answers only for enabled modules', async () => {
    loadModules({ available: [pages, issues], enabled: ['notes'] });
    expect(await notes!.entities.resolve('issue', { key: 'PLT-1' })).toBeNull();
  });
});
