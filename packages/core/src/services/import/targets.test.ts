import { describe, expect, it } from 'vitest';
import type { ImportTargetLookup } from '../../contracts/importer.ts';
import { resolveTargets, type TargetInput } from './targets.ts';

const here = [
  { id: '018f0000-0000-7000-8000-000000000001', key: 'SUP', name: 'Support' },
  { id: '018f0000-0000-7000-8000-000000000002', key: 'SHOP', name: 'Storefront' },
];

const lookup: ImportTargetLookup = {
  label: 'Work project',
  container: 'project',
  records: 'issues',
  keyFrom: (key) => key.toUpperCase().replace(/[^A-Z0-9]/g, ''),
  byKeys: async (keys) => here.filter((row) => keys.includes(row.key)),
  byIds: async (ids) => here.filter((row) => ids.includes(row.id)),
  search: async () => here,
};

const input = (over: Partial<TargetInput> & { id: string }): TargetInput => ({
  key: over.id,
  name: over.id,
  imported: null,
  request: null,
  ...over,
});

describe('resolveTargets', () => {
  it('makes a taken key an error, never a match', async () => {
    const out = await resolveTargets([input({ id: 'SUP' })], lookup, 'error');
    expect(out.get('SUP')).toMatchObject({
      mode: 'create',
      key: 'SUP',
      error:
        'SUP is taken by Support (a Work project). Pick another key, or bring these issues into Support.',
    });
  });

  it('catches two chosen projects asking for one key', async () => {
    const out = await resolveTargets(
      [
        input({ id: 'A', request: { mode: 'create', key: 'NEW' } }),
        input({ id: 'B', request: { mode: 'create', key: 'NEW' } }),
      ],
      lookup,
      'error',
    );
    expect(out.get('A')?.error).toBeNull();
    expect(out.get('B')?.error).toBe(
      'NEW is also the key of another chosen project. Pick another key.',
    );
  });

  it('takes the next free key with a note on the short path', async () => {
    const out = await resolveTargets([input({ id: 'SUP' })], lookup, 'suffix');
    expect(out.get('SUP')).toMatchObject({
      key: 'SUP2',
      error: null,
      note: 'SUP is taken by Support (a Work project); it becomes SUP2.',
    });
  });

  it('updates what an earlier import made, and writes into an existing project', async () => {
    const out = await resolveTargets(
      [
        input({ id: 'PLT', imported: { id: here[0]!.id, key: 'PLT', name: 'Platform' } }),
        input({ id: 'WEB', request: { mode: 'existing', id: here[1]!.id } }),
        input({
          id: 'GONE',
          request: { mode: 'existing', id: '018f0000-0000-7000-8000-00000000000f' },
        }),
      ],
      lookup,
      'error',
    );
    expect(out.get('PLT')).toMatchObject({ mode: 'update', key: 'PLT', error: null });
    expect(out.get('WEB')).toMatchObject({
      mode: 'existing',
      key: 'SHOP',
      note: 'Its issues are numbered on from the last SHOP key.',
    });
    expect(out.get('GONE')?.error).toBe('That Work project no longer exists. Pick another.');
  });
});
