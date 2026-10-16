import { describe, expect, it } from 'vitest';
import { fieldStats, type FieldValues, type StatValue } from './stats.ts';

const v = (id: string, order: number | null = null): StatValue => ({ id, label: id, order });
const map = (entries: [string, StatValue[]][]): FieldValues => new Map(entries);

describe('fieldStats', () => {
  it('counts one field in natural order and puts the none bucket last', () => {
    const result = fieldStats({
      issueIds: ['a', 'b', 'c', 'd'],
      by: 'status',
      byValues: map([
        ['a', [v('Done', 2)]],
        ['b', [v('Todo', 0)]],
        ['c', [v('Done', 2)]],
      ]),
    });
    expect(result.rows).toEqual([
      { id: 'Todo', label: 'Todo', count: 1 },
      { id: 'Done', label: 'Done', count: 2 },
      { id: null, label: 'No status', count: 1 },
    ]);
    expect(result.cells).toBeUndefined();
  });

  it('orders unordered buckets by size and counts a many-valued field once per value', () => {
    const result = fieldStats({
      issueIds: ['a', 'b'],
      by: 'label',
      byValues: map([
        ['a', [v('ui'), v('api')]],
        ['b', [v('api')]],
      ]),
    });
    expect(result.rows.map((row) => [row.label, row.count])).toEqual([
      ['api', 2],
      ['ui', 1],
    ]);
  });

  it('crosses two fields, leaving empty cells out', () => {
    const result = fieldStats({
      issueIds: ['a', 'b', 'c'],
      by: 'assignee',
      byValues: map([
        ['a', [v('ana')]],
        ['b', [v('ana')]],
      ]),
      by2: {
        field: 'priority',
        values: map([
          ['a', [v('high', 1)]],
          ['b', [v('low', 3)]],
          ['c', [v('high', 1)]],
        ]),
      },
    });
    expect(result.rows.map((row) => [row.id, row.count])).toEqual([
      ['ana', 2],
      [null, 1],
    ]);
    expect(result.columns).toEqual([
      { id: 'high', label: 'high' },
      { id: 'low', label: 'low' },
    ]);
    expect(result.cells).toEqual(
      expect.arrayContaining([
        { row: 'ana', column: 'high', count: 1 },
        { row: 'ana', column: 'low', count: 1 },
        { row: null, column: 'high', count: 1 },
      ]),
    );
    expect(result.cells).toHaveLength(3);
  });
});
