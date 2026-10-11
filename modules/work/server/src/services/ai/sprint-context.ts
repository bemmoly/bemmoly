import {
  aiRefusal,
  createContextWriter,
  type AiTargetContextBuilder,
  type SqlExecutor,
} from '@bemmoly/core';
import { projectResource } from '../issues/deps.ts';
import { issuePath } from '../issues/notify.ts';

export const SPRINT_CONTEXT_LIMITS = { issues: 60, chars: 14_000 } as const;
const DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SprintFacts {
  id: string;
  name: string;
  goal: string | null;
  startsAt: string | null;
  endsAt: string | null;
  state: string;
  projectId: string;
  projectKey: string;
}

interface SprintIssue {
  id: string;
  key: string;
  title: string;
  status: string;
  category: 'todo' | 'in_progress' | 'done';
  estimate: string | null;
  assignee: string | null;
  statusChangedAt: string;
  blockedBy: string[];
}

const days = (from: string, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / DAY_MS));

async function readSprint(sql: SqlExecutor, id: string): Promise<SprintFacts | null> {
  const [row] = await sql<SprintFacts[]>`
    select s.id, s.name, s.goal, s.starts_at::text as "startsAt", s.ends_at::text as "endsAt",
      s.state, s.project_id as "projectId", p.key as "projectKey"
    from sprints s join projects p on p.id = s.project_id where s.id = ${id}`;
  return row ?? null;
}

async function readSprintIssues(sql: SqlExecutor, sprintId: string): Promise<SprintIssue[]> {
  return sql<SprintIssue[]>`
    select i.id, i.key, i.title, s.name as status, s.category, i.estimate::text as estimate,
      u.name as assignee, i.status_changed_at::text as "statusChangedAt",
      coalesce((select array_agg(b.key order by b.key) from issue_links l
        join issues b on b.id = l.source_id join workflow_statuses bs on bs.id = b.status_id
        where l.kind = 'blocks' and l.target_id = i.id and b.deleted_at is null
          and bs.category <> 'done'), '{}') as "blockedBy"
    from issues i
    join workflow_statuses s on s.id = i.status_id
    left join users u on u.id = i.assignee_id
    where i.sprint_id = ${sprintId} and i.deleted_at is null
    order by s.category desc, i.status_changed_at
    limit ${SPRINT_CONTEXT_LIMITS.issues}`;
}

/** Points done against points committed, from the issues in the sprint now. */
export function pointsOf(issues: readonly SprintIssue[]): { done: number; committed: number } {
  let done = 0;
  let committed = 0;
  for (const issue of issues) {
    const points = issue.estimate ? Number(issue.estimate) : 0;
    committed += points;
    if (issue.category === 'done') done += points;
  }
  return { done, committed };
}

/**
 * sprintContext (tech design 11.3): goal, dates, every issue's status and age in it, points
 * done against committed, the blockers graph and how long reviews have waited. Only titles,
 * keys, statuses and field values: a sprint has no body text to withhold.
 */
export function createSprintContextBuilder(
  sql: () => SqlExecutor | undefined,
): AiTargetContextBuilder {
  return {
    type: 'target',
    targetKind: 'sprint',
    async canView(ctx, id) {
      const db = sql();
      if (!db || !UUID.test(id)) return false;
      const sprint = await readSprint(db, id);
      return sprint
        ? ctx.authz.can(ctx.actor, 'work.issue.view', projectResource(sprint.projectId))
        : false;
    },
    async build(id, options) {
      const db = sql();
      if (!db) return null;
      const sprint = await readSprint(db, id);
      if (!sprint) return null;
      const writer = createContextWriter({
        policy: options.policy,
        maxChars: SPRINT_CONTEXT_LIMITS.chars,
      });
      if (writer.excluded({ projectId: sprint.projectId })) throw aiRefusal('excluded');
      const issues = await readSprintIssues(db, id);
      const { done, committed } = pointsOf(issues);
      const today = options.now.toISOString().slice(0, 10);
      const left = sprint.endsAt
        ? Math.ceil((new Date(sprint.endsAt).getTime() - options.now.getTime()) / DAY_MS)
        : null;
      const scope = { projectId: sprint.projectId };
      writer.heading(`Sprint ${sprint.name}`);
      writer.cite({
        kind: 'sprint',
        objectId: sprint.id,
        label: sprint.name,
        href: '/work/board',
        line: [
          `${sprint.name} (${sprint.state})`,
          sprint.goal ? `goal: ${sprint.goal}` : 'no goal set',
          sprint.startsAt ? `from ${sprint.startsAt.slice(0, 10)}` : null,
          sprint.endsAt ? `to ${sprint.endsAt.slice(0, 10)}` : null,
          left === null ? null : `${Math.max(0, left)} days left as of ${today}`,
          `${done} of ${committed} points done`,
          `${issues.length} issues`,
        ]
          .filter(Boolean)
          .join(' · '),
        scope,
      });
      writer.heading('Issues');
      for (const issue of issues) {
        const age = days(issue.statusChangedAt, options.now);
        const waiting = /review/i.test(issue.status) ? ' (waiting on review)' : '';
        writer.cite({
          kind: 'issue',
          objectId: issue.id,
          label: issue.key,
          location: issue.status,
          href: issuePath(issue.key),
          line: [
            `${issue.key} · ${issue.title}`,
            `${issue.status}${waiting} for ${age} day${age === 1 ? '' : 's'}`,
            issue.estimate ? `${Number(issue.estimate)} pts` : 'unestimated',
            issue.assignee ?? 'unassigned',
            issue.blockedBy.length > 0 ? `blocked by ${issue.blockedBy.join(', ')}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
          scope,
          counts: 'issues',
        });
      }
      return writer.build(scope, { sprint: sprint.name, project: sprint.projectKey, today });
    },
    async lastChangedAt(id) {
      const db = sql();
      if (!db) return null;
      const [row] = await db<{ at: string | null }[]>`
        select greatest(
          (select updated_at from sprints where id = ${id}),
          (select max(updated_at) from issues where sprint_id = ${id})
        )::text as at`;
      return row?.at ? new Date(row.at) : null;
    },
  };
}
