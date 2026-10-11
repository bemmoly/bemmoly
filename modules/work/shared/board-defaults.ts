import { boardConfigSchema, CARD_FIELDS, type BoardColumn, type BoardConfig } from './boards.ts';

/*
 * Work's own default board, the one a project starts from when the org has no default board
 * scheme: one column per open status in workflow order, then one Done column for every done
 * status. The server creates boards from it and Board settings compares a board with it.
 */

export interface BoardStatus {
  id: string;
  name: string;
  category: 'todo' | 'in_progress' | 'done';
}

const slug = (name: string, taken: Set<string>): string => {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'column';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
};

/** The default board for a workflow's statuses, given in workflow order. */
export function defaultBoardConfig(statuses: readonly BoardStatus[]): BoardConfig {
  const taken = new Set<string>();
  const open = statuses.filter((status) => status.category !== 'done');
  const done = statuses.filter((status) => status.category === 'done');
  const columns: BoardColumn[] = open.map((status) => ({
    id: slug(status.name, taken),
    name: status.name,
    statusIds: [status.id],
  }));
  if (done.length > 0) {
    columns.push({
      id: slug(done[0]?.name ?? 'Done', taken),
      name: done[0]?.name ?? 'Done',
      statusIds: done.map((status) => status.id),
      done: true,
    });
  }
  while (columns.length < 2) {
    columns.push({ id: slug('Column', taken), name: 'Column', statusIds: [] });
  }
  return boardConfigSchema.parse({ columns });
}

const KNOWN_FIELDS: ReadonlySet<string> = new Set(CARD_FIELDS);

/**
 * A stored board config, read leniently: card fields this version does not know (written by a
 * newer one) are left out instead of failing the whole config. Null when it still does not parse.
 */
export function readBoardConfig(value: unknown): BoardConfig | null {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  const fields = raw?.['cardFields'];
  const cleaned = Array.isArray(fields)
    ? { ...raw, cardFields: fields.filter((field) => KNOWN_FIELDS.has(String(field))) }
    : value;
  const parsed = boardConfigSchema.safeParse(cleaned);
  return parsed.success ? parsed.data : null;
}
