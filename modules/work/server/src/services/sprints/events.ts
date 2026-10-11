import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { DOMAIN_EVENT_KINDS } from '@bemmoly/shared/webhooks';
import type { Sprint } from '../../../../shared/sprints.ts';
import type { IssueServiceDeps } from '../issues/deps.ts';

type SprintEventKind =
  typeof DOMAIN_EVENT_KINDS.sprintStarted | typeof DOMAIN_EVENT_KINDS.sprintCompleted;

/** sprint.started and sprint.completed, in the writer's transaction, for webhooks. */
export async function publishSprintEvent(
  deps: Pick<IssueServiceDeps, 'events' | 'now'>,
  ctx: RequestContext,
  tx: SqlExecutor,
  kind: SprintEventKind,
  sprint: Sprint,
): Promise<void> {
  const [project] = await tx<{ key: string }[]>`
    select key from projects where id = ${sprint.projectId}`;
  const verb = kind === DOMAIN_EVENT_KINDS.sprintStarted ? 'started' : 'completed';
  const snapshot = sprint.completedSnapshot;
  await deps.events.publish({
    kind,
    occurredAt: deps.now?.() ?? new Date(),
    actor: ctx.actor,
    entity: { kind: 'sprint', id: sprint.id },
    payload: {
      summary: `${project?.key ?? ''} ${sprint.name} ${verb}`.trim(),
      url: project ? `/work/board/${project.key}` : '/work/board',
      sprint: {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal?.slice(0, 280) ?? null,
        projectId: sprint.projectId,
        projectKey: project?.key ?? null,
        startsAt: sprint.startsAt,
        endsAt: sprint.endsAt,
        ...(snapshot
          ? {
              committedIssues: snapshot.committedIssues,
              completedIssues: snapshot.completedIssues,
              completedPoints: snapshot.completedPoints,
            }
          : {}),
      },
    },
    transaction: tx,
  });
}
