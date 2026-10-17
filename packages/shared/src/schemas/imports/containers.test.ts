import { describe, expect, it } from 'vitest';
import {
  applySelection,
  importSelectionBodySchema,
  importSelectionOpSchema,
  matchesScope,
  type ImportContainerRow,
} from './containers.ts';
import { updateImportBodySchema } from './imports.ts';

const row = (over: Partial<ImportContainerRow> = {}): ImportContainerRow => ({
  id: '10001',
  key: 'PLT',
  name: 'Platform',
  kind: 'project',
  type: 'Software',
  lead: 'Rohan Shah',
  access: 'ok',
  count: 1840,
  imported: null,
  keyInUse: false,
  selected: false,
  ...over,
});

const imported = {
  id: '018f0000-0000-7000-8000-000000000001',
  key: 'PLT',
  name: 'Platform',
  at: '2026-10-02T09:00:00.000Z',
};

describe('matchesScope', () => {
  it('searches key, name and lead without regard to case', () => {
    expect(matchesScope(row(), { filter: 'all', q: 'plt' })).toBe(true);
    expect(matchesScope(row(), { filter: 'all', q: 'FORM' })).toBe(true);
    expect(matchesScope(row(), { filter: 'all', q: 'rohan' })).toBe(true);
    expect(matchesScope(row(), { filter: 'all', q: 'mobile' })).toBe(false);
  });

  it('filters new, imported before, no access and selected', () => {
    expect(matchesScope(row(), { filter: 'new' })).toBe(true);
    expect(matchesScope(row({ imported }), { filter: 'new' })).toBe(false);
    expect(matchesScope(row({ access: 'none' }), { filter: 'new' })).toBe(false);
    expect(matchesScope(row({ imported }), { filter: 'imported' })).toBe(true);
    expect(matchesScope(row({ access: 'none' }), { filter: 'noaccess' })).toBe(true);
    expect(matchesScope(row({ selected: true }), { filter: 'selected' })).toBe(true);
    expect(matchesScope(row(), { filter: 'selected' })).toBe(false);
  });
});

describe('applySelection', () => {
  it('replays ticks by id and by scope in order', () => {
    const ops = [
      { select: true, scope: { filter: 'all' as const } },
      { select: false, ids: ['10001'] },
    ];
    expect(applySelection(row(), ops)).toBe(false);
    expect(applySelection(row({ id: '10002' }), ops)).toBe(true);
    expect(
      applySelection(row(), [
        ...ops,
        { select: true, scope: { filter: 'all' as const, q: 'plat' } },
      ]),
    ).toBe(true);
  });

  it('selects all except, then a search narrows a later untick', () => {
    const ops = [
      { select: true, scope: { filter: 'new' as const } },
      { select: false, scope: { filter: 'all' as const, q: 'mobile' } },
    ];
    expect(applySelection(row(), ops)).toBe(true);
    expect(applySelection(row({ name: 'Mobile apps' }), ops)).toBe(false);
    expect(applySelection(row({ imported }), ops)).toBe(false);
  });

  it('never ticks a row the token cannot read', () => {
    expect(applySelection(row({ access: 'none' }), [{ select: true, ids: ['10001'] }])).toBe(false);
  });

  it('is the same whether a prefix of the operations was already applied', () => {
    const ops = [
      { select: true, ids: ['10001'] },
      { select: false, scope: { filter: 'all' as const, q: 'zzz' } },
    ];
    const once = applySelection(row(), ops);
    const base = applySelection(row(), ops.slice(0, 1));
    expect(applySelection(row({ selected: base }), ops)).toBe(once);
  });

  it('clears, and restore puts back what the row had', () => {
    expect(applySelection(row({ selected: true }), [{ clear: true }])).toBe(false);
    expect(
      applySelection(row({ selected: true }), [{ clear: true }, { restore: true }], true),
    ).toBe(true);
  });
});

describe('selection and plan bodies', () => {
  it('takes one scope operation instead of every id', () => {
    expect(importSelectionOpSchema.parse({ select: true, scope: { filter: 'all' } })).toEqual({
      select: true,
      scope: { filter: 'all' },
    });
    expect(() => importSelectionBodySchema.parse({ ops: [] })).toThrow();
    expect(() => importSelectionOpSchema.parse({ select: true, ids: [] })).toThrow();
  });

  it('plans more than 500 named containers, or none (the selection)', () => {
    const ids = Array.from({ length: 1240 }, (_, index) => String(20000 + index));
    expect(updateImportBodySchema.parse({ containers: ids }).containers).toHaveLength(1240);
    expect(updateImportBodySchema.parse({})).toEqual({});
  });
});
