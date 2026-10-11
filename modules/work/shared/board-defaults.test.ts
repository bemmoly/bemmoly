import { describe, expect, it } from 'vitest';
import { defaultBoardConfig, readBoardConfig } from './board-defaults.ts';

const id = (n: number) => `018f0000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

const STATUSES = [
  { id: id(1), name: 'Backlog', category: 'todo' },
  { id: id(2), name: 'In progress', category: 'in_progress' },
  { id: id(3), name: 'Done', category: 'done' },
  { id: id(4), name: "Won't do", category: 'done' },
] as const;

describe('defaultBoardConfig', () => {
  it('makes one column per open status, then one Done column for every done status', () => {
    const config = defaultBoardConfig(STATUSES);
    expect(config.columns).toEqual([
      { id: 'backlog', name: 'Backlog', statusIds: [id(1)], wipLimit: null, done: false },
      { id: 'in-progress', name: 'In progress', statusIds: [id(2)], wipLimit: null, done: false },
      { id: 'done', name: 'Done', statusIds: [id(3), id(4)], wipLimit: null, done: true },
    ]);
    expect(config.cardFields).toEqual([
      'type',
      'key',
      'priority',
      'labels',
      'estimate',
      'assignee',
    ]);
    expect(config.colorRule).toBe('none');
  });
});

describe('readBoardConfig', () => {
  const columns = defaultBoardConfig(STATUSES).columns;

  it('keeps every card field it knows, the time in column among them', () => {
    expect(readBoardConfig({ columns, cardFields: ['due', 'age', 'key'] })?.cardFields).toEqual([
      'due',
      'age',
      'key',
    ]);
  });

  it('drops card fields a newer version wrote instead of losing the whole config', () => {
    const config = readBoardConfig({ columns, cardFields: ['key', 'sparkles'], colorRule: 'type' });
    expect(config?.cardFields).toEqual(['key']);
    expect(config?.colorRule).toBe('type');
    expect(config?.columns).toHaveLength(3);
  });

  it('is null for a config that still does not parse', () => {
    expect(readBoardConfig({ columns: [] })).toBeNull();
    expect(readBoardConfig(null)).toBeNull();
  });
});
