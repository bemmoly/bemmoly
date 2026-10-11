import { describe, expect, it } from 'vitest';
import {
  addColumn,
  columnProblems,
  hiddenWork,
  moveColumn,
  moveStatus,
  parseWip,
  removeColumn,
  renameColumn,
  setWip,
  unmappedStatuses,
} from './columns.ts';
import { columnsRisk } from './risks.ts';
import { boardConfig, COUNTS, S, STATUSES } from './fixtures.ts';

const names = (config: ReturnType<typeof boardConfig>) => config.columns.map((c) => c.name);

describe('column mapping', () => {
  it('adds a column before the done column with a free id', () => {
    const once = addColumn(boardConfig());
    const twice = addColumn(once);
    expect(names(twice)).toEqual([
      'To do',
      'In progress',
      'In review',
      'QA',
      'New column',
      'New column',
      'Done',
    ]);
    expect(twice.columns[4]?.id).toBe('new-column');
    expect(twice.columns[5]?.id).toBe('new-column-2');
  });

  it('renames, reorders and keeps at least two columns', () => {
    const renamed = renameColumn(boardConfig(), 'qa', 'Verify');
    expect(names(moveColumn(renamed, 3, 0))[0]).toBe('Verify');
    expect(moveColumn(renamed, 9, 0)).toBe(renamed);
    let small = boardConfig();
    for (const id of ['todo', 'progress', 'review', 'qa']) small = removeColumn(small, id);
    expect(names(small)).toEqual(['QA', 'Done']);
  });

  it('reads WIP limits as positive whole numbers or none', () => {
    expect(parseWip('3')).toBe(3);
    expect(parseWip(' 12 ')).toBe(12);
    expect(parseWip('0')).toBeNull();
    expect(parseWip('-2')).toBeNull();
    expect(parseWip('')).toBeNull();
    expect(setWip(boardConfig(), 'qa', '5').columns[3]?.wipLimit).toBe(5);
  });

  it('moves a status between columns and off the board, never into two', () => {
    const moved = moveStatus(boardConfig(), S['Testing']!, 'review');
    expect(moved.columns.find((c) => c.id === 'review')?.statusIds).toEqual([
      S['Code review'],
      S['Testing'],
    ]);
    expect(moved.columns.find((c) => c.id === 'qa')?.statusIds).toEqual([]);
    const off = moveStatus(moved, S['Testing']!, null);
    expect(unmappedStatuses(off, STATUSES).map((s) => s.name)).toEqual(['Testing', "Won't do"]);
  });

  it('names what stops a save', () => {
    expect(columnProblems(boardConfig())).toEqual([]);
    const blank = renameColumn(boardConfig(), 'qa', '  ');
    expect(columnProblems(blank)).toEqual(['Column 4 needs a name.']);
    const twin = renameColumn(boardConfig(), 'qa', 'done');
    expect(columnProblems(twin)).toEqual(['Two columns are called "Done".']);
  });
});

describe('hidden work', () => {
  it('counts the issues a removed column and an unmapped status take off the board', () => {
    const after = moveStatus(removeColumn(boardConfig(), 'qa'), S['Code review']!, null);
    const hidden = hiddenWork(boardConfig(), after, STATUSES, COUNTS);
    expect(hidden.removedColumns).toEqual([{ name: 'QA', issues: 2 }]);
    expect(hidden.unmapped).toEqual([{ name: 'Code review', issues: 2 }]);
    expect(hidden.total).toBe(4);
  });

  it('does not count a removed column whose statuses moved to another column', () => {
    const moved = moveStatus(boardConfig(), S['Testing']!, 'review');
    expect(hiddenWork(boardConfig(), removeColumn(moved, 'qa'), STATUSES, COUNTS).total).toBe(0);
  });

  it('asks before hiding cards and not otherwise', () => {
    expect(columnsRisk(boardConfig(), addColumn(boardConfig()), STATUSES, COUNTS)).toBeNull();
    const risk = columnsRisk(boardConfig(), removeColumn(boardConfig(), 'qa'), STATUSES, COUNTS);
    expect(risk?.title).toBe('Take 2 issues off the board?');
    expect(risk?.consequences[0]).toBe('"QA" is removed, and its 2 issues leave the board.');
  });
});
