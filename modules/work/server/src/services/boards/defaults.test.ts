import { describe, expect, it } from 'vitest';
import type { StatusRow } from './context.ts';
import { adoptConfig, defaultConfig } from './defaults.ts';

/** Status ids are uuids, as the config schema asks; the number keeps the expectations short. */
const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const status = (n: number, name: string, category: StatusRow['category']): StatusRow => ({
  id: id(n),
  name,
  category,
  position: n,
});

const STATUSES: StatusRow[] = [
  status(1, 'Backlog', 'todo'),
  status(2, 'In progress', 'in_progress'),
  status(3, 'In progress!', 'in_progress'),
  status(4, 'Done', 'done'),
  status(5, "Won't do", 'done'),
];

describe('defaultConfig', () => {
  it('gives every open status a column and puts the done ones together', () => {
    const config = defaultConfig(STATUSES);
    expect(config.columns.map((c) => [c.id, c.name, c.statusIds, c.done])).toEqual([
      ['backlog', 'Backlog', [id(1)], false],
      ['in-progress', 'In progress', [id(2)], false],
      ['in-progress-2', 'In progress!', [id(3)], false],
      ['done', 'Done', [id(4), id(5)], true],
    ]);
    expect(config.lanes.kind).toBe('none');
    expect(config.cadenceDays).toBe(14);
  });

  it('still makes the two columns a board needs from a workflow with one status', () => {
    expect(defaultConfig([status(1, 'Open', 'todo')]).columns).toHaveLength(2);
  });
});

describe('adoptConfig', () => {
  const scheme = defaultConfig([
    status(100, 'Backlog', 'todo'),
    status(200, 'Review', 'in_progress'),
    status(300, 'Done', 'done'),
  ]);
  const names = new Map([
    [id(100), 'Backlog'],
    [id(200), 'Review'],
    [id(300), 'Done'],
  ]);

  it("re-points the scheme's columns at the project's statuses by name", () => {
    const adopted = adoptConfig({ ...scheme, cadenceDays: 7 }, names, STATUSES);
    expect(adopted?.columns.map((column) => column.statusIds)).toEqual([[id(1)], [id(4)]]);
    expect(adopted?.cadenceDays).toBe(7);
  });

  it('gives up when fewer than two columns survive', () => {
    expect(adoptConfig(scheme, names, [status(9, 'Backlog', 'todo')])).toBeNull();
  });
});
