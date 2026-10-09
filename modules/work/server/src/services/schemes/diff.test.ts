import { describe, expect, it } from 'vitest';
import { diffConfig, diffItems, type DiffItem } from './diff.ts';

const item = (key: string, value: Record<string, unknown>, originKey: string | null = key) =>
  ({ key, label: String(value['name'] ?? key), originKey, value }) satisfies DiffItem;

describe('diffItems', () => {
  it('pairs copies with their origin and reports added, removed and changed rows', () => {
    const org = [item('bug', { name: 'Bug', color: 'red' }), item('task', { name: 'Task' })];
    const project = [
      item('bug', { name: 'Defect', color: 'red' }),
      item('spike', { name: 'Spike' }, null),
    ];
    expect(diffItems(org, project, ['name', 'color'])).toEqual([
      {
        key: 'bug',
        label: 'Defect',
        change: 'changed',
        before: { name: 'Bug', color: 'red' },
        after: { name: 'Defect', color: 'red' },
        attributes: ['name'],
      },
      { key: 'spike', label: 'Spike', change: 'added', after: { name: 'Spike' }, attributes: [] },
      { key: 'task', label: 'Task', change: 'removed', before: { name: 'Task' }, attributes: [] },
    ]);
  });

  it('pairs a renamed key through its origin and finds nothing in an untouched copy', () => {
    const org = [item('bug', { name: 'Bug' })];
    expect(diffItems(org, [item('defect', { name: 'Bug' }, 'bug')], ['name'])).toEqual([]);
    expect(diffItems(org, org, ['name'])).toEqual([]);
  });
});

describe('diffConfig', () => {
  it('reports leaf paths, counting array items from one', () => {
    const base = { columns: [{ name: 'To do', wipLimit: null }], swimlanes: 'none' };
    const next = { columns: [{ name: 'To do', wipLimit: 4 }], swimlanes: 'epic', extra: true };
    expect(diffConfig(base, next)).toEqual([
      {
        key: ['columns', 0, 'wipLimit'].join('.'),
        label: 'columns › 1 › wipLimit',
        change: 'changed',
        before: null,
        after: 4,
        attributes: [],
      },
      {
        key: 'swimlanes',
        label: 'swimlanes',
        change: 'changed',
        before: 'none',
        after: 'epic',
        attributes: [],
      },
      { key: 'extra', label: 'extra', change: 'added', after: true, attributes: [] },
    ]);
  });

  it('treats a column list of another length as one change', () => {
    const entries = diffConfig({ columns: [1, 2] }, { columns: [1, 2, 3] });
    expect(entries).toEqual([
      {
        key: 'columns',
        label: 'columns',
        change: 'changed',
        before: [1, 2],
        after: [1, 2, 3],
        attributes: [],
      },
    ]);
  });
});
