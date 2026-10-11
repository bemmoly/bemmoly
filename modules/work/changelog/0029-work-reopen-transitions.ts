import { changeset, sql, type ChangesetContext } from '@bemmoly/core/changelog';

/*
 * The default workflow seeded by 0018 has no way out of Done or Won't do, so a closed issue
 * can never be reopened. Each done status with no transition of its own gets a "Reopen" back
 * to the workflow's first todo status (Backlog in the seed). It runs on the org default and on
 * the project copies taken from it; a status that already has a transition out was drawn that
 * way on purpose and is left alone, as is a workflow with no todo status. 0018 is not edited,
 * since its checksum is recorded; a new install runs both and starts with Reopen.
 *
 * Transitions are live rows, published versions keep no snapshot, so an insert is the whole
 * change. A saved draft gets the same transition, or publishing it would drop the row again.
 * Down removes only what up added: the transitions carrying up's marker in their rules, which
 * the rules registry ignores.
 */
const NAME = 'Reopen';
const MARKER = '0029-work-reopen-transitions';

interface Candidate extends Record<string, unknown> {
  workflow_id: string;
  from_id: string;
  from_name: string;
  to_id: string;
  position: number;
}

interface DraftTransition {
  id: string;
  fromStatusId: string | null;
  toStatusId: string;
  name: string;
  rules?: unknown;
  position: number;
}

interface Draft {
  statuses: { id: string }[];
  transitions: DraftTransition[];
}

/**
 * Transition names are how scheme diffs tell transitions apart, so each is unique in its
 * workflow: "Reopen" for the first done status, "Reopen from Won't do" for the next.
 */
function nameFor(statusName: string, taken: Set<string>): string {
  const plain = NAME.toLowerCase();
  const name = taken.has(plain) ? `${NAME} from ${statusName}`.slice(0, 60) : NAME;
  taken.add(name.toLowerCase());
  return name;
}

async function transitionNames(ctx: ChangesetContext): Promise<Map<string, Set<string>>> {
  const rows = await ctx.query<{ workflow_id: string; name: string }>(sql`
    SELECT workflow_id, name FROM workflow_transitions`);
  const names = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = names.get(row.workflow_id) ?? new Set<string>();
    set.add(row.name.toLowerCase());
    names.set(row.workflow_id, set);
  }
  return names;
}

const RULES = { conditions: [], validators: [], postActions: [], seededBy: MARKER };

export default changeset({
  id: '0029-work-reopen-transitions',
  author: 'bemmoly',
  description: 'Add a Reopen transition from done statuses that have no way out',
  contexts: ['*'],
  up: async (ctx) => {
    const candidates = await ctx.query<Candidate>(sql`
      SELECT s.workflow_id, s.id AS from_id, s.name AS from_name, t.id AS to_id,
        (SELECT coalesce(max(position), -1) + 1 FROM workflow_transitions
           WHERE workflow_id = s.workflow_id) AS position
      FROM workflow_statuses s
      JOIN workflows w ON w.id = s.workflow_id
      JOIN LATERAL (
        SELECT id FROM workflow_statuses
        WHERE workflow_id = s.workflow_id AND category = 'todo'
        ORDER BY position, id LIMIT 1
      ) t ON true
      WHERE s.category = 'done'
        AND (w.project_id IS NULL OR w.origin_id IN (
          SELECT id FROM workflows WHERE project_id IS NULL))
        AND NOT EXISTS (
          SELECT 1 FROM workflow_transitions x WHERE x.from_status_id = s.id)
      ORDER BY s.workflow_id, s.position, s.id`);
    const offsets = new Map<string, number>();
    const names = await transitionNames(ctx);
    for (const candidate of candidates) {
      const offset = offsets.get(candidate.workflow_id) ?? 0;
      offsets.set(candidate.workflow_id, offset + 1);
      const position = Number(candidate.position) + offset;
      const taken = names.get(candidate.workflow_id) ?? new Set<string>();
      names.set(candidate.workflow_id, taken);
      const name = nameFor(candidate.from_name, taken);
      const [row] = await ctx.query<{ id: string }>(sql`
        INSERT INTO workflow_transitions (workflow_id, from_status_id, to_status_id, name,
          rules, position)
        VALUES (${candidate.workflow_id}, ${candidate.from_id}, ${candidate.to_id}, ${name},
          ${JSON.stringify(RULES)}::jsonb, ${position})
        RETURNING id`);
      const [workflow] = await ctx.query<{ draft: Draft | null }>(sql`
        SELECT draft FROM workflows WHERE id = ${candidate.workflow_id}`);
      const draft = workflow?.draft;
      if (!row || !draft) continue;
      const ids = new Set(draft.statuses.map((status) => status.id));
      const blocked = draft.transitions.some((item) => item.fromStatusId === candidate.from_id);
      if (!ids.has(candidate.from_id) || !ids.has(candidate.to_id) || blocked) continue;
      const transitions: DraftTransition[] = [
        ...draft.transitions,
        {
          id: row.id,
          fromStatusId: candidate.from_id,
          toStatusId: candidate.to_id,
          name,
          rules: RULES,
          position: draft.transitions.length,
        },
      ];
      await ctx.exec(sql`
        UPDATE workflows SET draft = ${JSON.stringify({ ...draft, transitions })}::jsonb
        WHERE id = ${candidate.workflow_id}`);
    }
  },
  down: async (ctx) => {
    const drafts = await ctx.query<{ id: string; draft: Draft }>(sql`
      SELECT id, draft FROM workflows WHERE draft IS NOT NULL`);
    for (const { id, draft } of drafts) {
      const transitions = draft.transitions.filter(
        (item) => (item.rules as { seededBy?: string } | undefined)?.seededBy !== MARKER,
      );
      if (transitions.length === draft.transitions.length) continue;
      await ctx.exec(sql`
        UPDATE workflows SET draft = ${JSON.stringify({ ...draft, transitions })}::jsonb
        WHERE id = ${id}`);
    }
    await ctx.exec(sql`
      DELETE FROM workflow_transitions
      WHERE rules ->> 'seededBy' = ${MARKER}`);
  },
});
