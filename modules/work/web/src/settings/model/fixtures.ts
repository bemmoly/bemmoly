import { boardConfigSchema, type BoardConfig } from '@bemmoly/module-work/shared';
import type { StatusInfo } from './columns.ts';

/** The Board Settings mock's statuses and columns, for the model tests. */

const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;

export const STATUSES: StatusInfo[] = [
  { id: id(1), name: 'Backlog', category: 'todo', color: null },
  { id: id(2), name: 'Selected', category: 'todo', color: null },
  { id: id(3), name: 'In progress', category: 'in_progress', color: null },
  { id: id(4), name: 'Code review', category: 'in_progress', color: '#8b5cf6' },
  { id: id(5), name: 'Testing', category: 'in_progress', color: '#d49a1a' },
  { id: id(6), name: 'Done', category: 'done', color: null },
  { id: id(7), name: "Won't do", category: 'done', color: null },
];

export const S = Object.fromEntries(STATUSES.map((status) => [status.name, status.id])) as Record<
  string,
  string
>;

export const COUNTS: Record<string, number> = {
  [id(1)]: 42,
  [id(2)]: 9,
  [id(3)]: 4,
  [id(4)]: 2,
  [id(5)]: 2,
  [id(6)]: 9,
};

export const statusName = (statusId: string) =>
  STATUSES.find((status) => status.id === statusId)?.name ?? 'Unknown status';

export function boardConfig(overrides: Partial<BoardConfig> = {}): BoardConfig {
  return boardConfigSchema.parse({
    columns: [
      { id: 'todo', name: 'To do', statusIds: [id(1), id(2)] },
      { id: 'progress', name: 'In progress', statusIds: [id(3)], wipLimit: 4 },
      { id: 'review', name: 'In review', statusIds: [id(4)] },
      { id: 'qa', name: 'QA', statusIds: [id(5)] },
      { id: 'done', name: 'Done', statusIds: [id(6)], done: true },
    ],
    ...overrides,
  });
}
