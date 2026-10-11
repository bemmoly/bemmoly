import { changeset, sql } from '@bemmoly/core/changelog';

/*
 * The org default board, "Workspace board", which every project's board is
 * compared with and follows until it changes its own. Until now nothing made
 * one, so project settings compared with nothing. It is seeded from the org
 * default workflow as a project's first board was made: one column per open
 * status in workflow order, then one Done column for every done status. The
 * rest of the board config takes its defaults when it is read. Frozen here,
 * like the other seeds; skipped when a default board already exists.
 */
const NAME = 'Workspace board';

interface StatusRow extends Record<string, unknown> {
  id: string;
  name: string;
  category: 'todo' | 'in_progress' | 'done';
}

function slug(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'column';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function columnsFor(statuses: readonly StatusRow[]) {
  const taken = new Set<string>();
  const done = statuses.filter((status) => status.category === 'done');
  const columns: { id: string; name: string; statusIds: string[]; done?: true }[] = statuses
    .filter((status) => status.category !== 'done')
    .map((status) => ({ id: slug(status.name, taken), name: status.name, statusIds: [status.id] }));
  if (done.length > 0) {
    const name = done[0]?.name ?? 'Done';
    columns.push({
      id: slug(name, taken),
      name,
      statusIds: done.map((status) => status.id),
      done: true,
    });
  }
  while (columns.length < 2)
    columns.push({ id: slug('Column', taken), name: 'Column', statusIds: [] });
  return columns;
}

export default changeset({
  id: '0025-work-default-board',
  author: 'bemmoly',
  description: 'Seed the org default board from the org default workflow',
  contexts: ['*'],
  up: async (ctx) => {
    const existing = await ctx.query<{ id: string }>(sql`
      SELECT id FROM boards WHERE project_id IS NULL LIMIT 1`);
    if (existing.length > 0) return;
    const statuses = await ctx.query<StatusRow>(sql`
      SELECT s.id, s.name, s.category FROM workflow_statuses s
      JOIN workflows w ON w.id = s.workflow_id
      WHERE w.project_id IS NULL
      ORDER BY w.id, s.position, s.id`);
    const config = { columns: columnsFor(statuses) };
    await ctx.exec(sql`
      INSERT INTO boards (project_id, name, config)
      VALUES (NULL, ${NAME}, ${JSON.stringify(config)}::jsonb)`);
  },
  down: async (ctx) => {
    await ctx.exec(sql`DELETE FROM boards WHERE project_id IS NULL AND name = ${NAME}`);
  },
});
