import { describe, expect, it } from 'vitest';
import { invertDiff } from './diff-dialog.tsx';

describe('invertDiff', () => {
  it('reads a project copy diff as what a reset removes and puts back', () => {
    expect(
      invertDiff([
        { key: 'f.team', label: 'Field Team', change: 'added', after: 'Team', attributes: [] },
        {
          key: 'f.size',
          label: 'Field Size',
          change: 'changed',
          before: 'S',
          after: 'M',
          attributes: ['name'],
        },
      ]),
    ).toEqual([
      { key: 'f.team', label: 'Field Team', change: 'removed', before: 'Team', attributes: [] },
      {
        key: 'f.size',
        label: 'Field Size',
        change: 'changed',
        before: 'M',
        after: 'S',
        attributes: ['name'],
      },
    ]);
  });
});
