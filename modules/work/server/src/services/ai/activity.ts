import type { AiActivitySource, SqlExecutor } from '@bemmoly/core';
import { issuePath } from '../issues/notify.ts';

export const WORK_ACTIVITY_LIMITS = { issues: 25, sprints: 3 } as const;

interface ChangedIssue {
  id: string;
  key: string;
  title: string;
  status: string;
  projectId: string;
  assignee: string | null;
  mine: boolean;
  watching: boolean;
  changes: number;
  comments: number;
  lastCommentAuthorId: string | null;
  lastCommentAuthor: string | null;
  lastComment: string | null;
  blocks: number;
}

interface ActiveSprint {
  id: string;
  name: string;
  projectId: string;
  done: string;
  committed: string;
  endsAt: string | null;
}

/**
 * Work's share of the morning brief: issues in the person's projects that changed since
 * their last visit, theirs first (assigned, reported or watched), each once with what
 * happened to it, then their active sprints' points.
 */
export function createWorkActivitySource(sql: () => SqlExecutor | undefined): AiActivitySource {
  return {
    type: 'activity',
    async collect(writer, { userId, since }) {
      const db = sql();
      if (!db) return;
      const after = since.toISOString();
      const issues = await db<ChangedIssue[]>`
        with mine as (select project_id from project_members where user_id = ${userId}),
        changed as (
          select i.id from issues i
          where i.project_id in (select project_id from mine) and i.deleted_at is null
            and (i.updated_at > ${after}::timestamptz
              or exists (select 1 from comments c where c.target_kind = 'issue'
                and c.target_id = i.id and c.created_at > ${after}::timestamptz))
        )
        select i.id, i.key, i.title, s.name as status, i.project_id as "projectId",
          a.name as assignee,
          (i.assignee_id = ${userId} or i.reporter_id = ${userId}) as mine,
          exists (select 1 from watchers w where w.target_kind = 'issue'
            and w.target_id = i.id and w.user_id = ${userId}) as watching,
          (select count(*)::int from issue_history h where h.issue_id = i.id
            and h.created_at > ${after}::timestamptz) as changes,
          (select count(*)::int from comments c where c.target_kind = 'issue'
            and c.target_id = i.id and c.deleted_at is null
            and c.created_at > ${after}::timestamptz) as comments,
          lc.author_id as "lastCommentAuthorId", lu.name as "lastCommentAuthor",
          lc.body_text as "lastComment",
          (select count(*)::int from issue_links l where l.kind = 'blocks'
            and l.source_id = i.id) as blocks
        from issues i
        join changed on changed.id = i.id
        join workflow_statuses s on s.id = i.status_id
        left join users a on a.id = i.assignee_id
        left join lateral (select c.author_id, c.body_text from comments c
          where c.target_kind = 'issue' and c.target_id = i.id and c.deleted_at is null
            and c.created_at > ${after}::timestamptz
          order by c.id desc limit 1) lc on true
        left join users lu on lu.id = lc.author_id
        order by (i.assignee_id = ${userId} or i.reporter_id = ${userId}) desc,
          i.updated_at desc
        limit ${WORK_ACTIVITY_LIMITS.issues}`;
      const visible = issues.filter((issue) => !writer.excluded({ projectId: issue.projectId }));
      if (visible.length > 0) writer.heading('Issues that changed');
      for (const issue of visible) {
        const facts = [
          `${issue.key} · ${issue.title} · ${issue.status}`,
          issue.assignee ? `assignee ${issue.assignee}` : 'unassigned',
          issue.mine ? 'yours' : issue.watching ? 'you watch it' : null,
          issue.changes > 0 ? `${issue.changes} field changes` : null,
          issue.comments > 0 ? `${issue.comments} new comments` : null,
          issue.blocks > 0 ? `blocks ${issue.blocks} issues` : null,
        ];
        writer.cite({
          kind: 'issue',
          objectId: issue.id,
          label: issue.key,
          href: issuePath(issue.key),
          line: facts.filter(Boolean).join(' · '),
          body: issue.lastComment
            ? `Latest comment by ${issue.lastCommentAuthor ?? 'someone'}: ${issue.lastComment}`
            : null,
          scope: { projectId: issue.projectId, authorId: issue.lastCommentAuthorId },
          counts: 'updates',
        });
      }

      const sprints = await db<ActiveSprint[]>`
        select s.id, s.name, s.project_id as "projectId", s.ends_at::text as "endsAt",
          coalesce(sum(i.estimate) filter (where st.category = 'done'), 0)::text as done,
          coalesce(sum(i.estimate), 0)::text as committed
        from sprints s
        left join issues i on i.sprint_id = s.id and i.deleted_at is null
        left join workflow_statuses st on st.id = i.status_id
        where s.state = 'active'
          and s.project_id in (select project_id from project_members where user_id = ${userId})
        group by s.id order by s.ends_at nulls last limit ${WORK_ACTIVITY_LIMITS.sprints}`;
      const active = sprints.filter((sprint) => !writer.excluded({ projectId: sprint.projectId }));
      if (active.length > 0) writer.heading('Active sprints');
      for (const sprint of active) {
        writer.cite({
          kind: 'sprint',
          objectId: sprint.id,
          label: sprint.name,
          href: '/work/board',
          line: `${sprint.name} · ${Number(sprint.done)} of ${Number(sprint.committed)} points done${
            sprint.endsAt ? ` · ends ${sprint.endsAt.slice(0, 10)}` : ''
          }`,
          scope: { projectId: sprint.projectId },
        });
      }
    },
  };
}
