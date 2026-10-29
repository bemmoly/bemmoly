import type { RequestContext, StartSourceDefinition } from '@bemmoly/core';
import type { ModuleStartSummaryInput, StartEntry } from '@bemmoly/shared';
import type { ApprovalRequest } from '@bemmoly/shared/approvals';
import { today, userIdOf, type PeopleServiceDeps } from '../common.ts';
import type { DirectoryService } from '../directory/index.ts';
import type { JourneysService } from '../journeys/index.ts';

const LIMIT = 8;
const at = (date: string) => `${date}T09:00:00Z`;

/**
 * People's part of the start page: time off waiting on the person's approval is the count;
 * "needs you" is those approvals and their open journey tasks; the recent list is the news a
 * People screen leads with, who joins soon and who is out.
 */
export function createPeopleStartSource(
  deps: PeopleServiceDeps,
  services: { directory: DirectoryService; journeys: JourneysService },
) {
  async function waiting(ctx: RequestContext): Promise<ApprovalRequest[]> {
    if (!deps.approvals) return [];
    const page = await deps.approvals.list(ctx.actor, { scope: 'waiting', moduleId: 'people' });
    return page.items;
  }

  return {
    async summaryForUser(ctx: RequestContext): Promise<ModuleStartSummaryInput> {
      if (!userIdOf(ctx)) return { waiting: null, needsYou: [], recent: [] };
      const day = today(deps);
      const [approvals, tasks, everyone] = await Promise.all([
        waiting(ctx),
        services.journeys.myTasks(ctx),
        services.directory.list(ctx, {}),
      ]);
      const names = new Map(everyone.map((person) => [person.userId, person.name]));
      const needsYou: StartEntry[] = [
        ...approvals.map((request) => ({
          id: `approval:${request.id}`,
          title: request.title,
          context: 'Time off to approve',
          path: '/people/time-off?tab=approvals',
          at: request.createdAt,
        })),
        ...tasks.map((task) => ({
          id: `task:${task.id}`,
          title: task.title,
          context: `${task.kind === 'onboarding' ? 'Onboarding' : 'Offboarding'} · ${names.get(task.journeyUserId) ?? 'Someone'}`,
          path: `/people/journeys/${task.journeyId}`,
          at: at(task.dueDate),
        })),
      ];
      const news = everyone
        .filter((person) => person.happening && person.happening.kind !== 'away_soon')
        .sort((a, b) => (a.happening!.date < b.happening!.date ? -1 : 1))
        .map((person) => ({
          id: `person:${person.userId}`,
          title: person.name,
          context:
            person.happening!.kind === 'joining'
              ? `Joins ${person.happening!.date}`
              : person.happening!.kind === 'leaving'
                ? `Last day ${person.happening!.date}`
                : `Out until ${person.happening!.until ?? person.happening!.date}`,
          path: `/people/p/${person.userId}`,
          at: at(person.happening!.date <= day ? day : person.happening!.date),
        }));
      return {
        waiting: approvals.length
          ? {
              count: approvals.length,
              label: approvals.length === 1 ? 'time off request' : 'time off requests',
            }
          : null,
        needsYou: needsYou.slice(0, LIMIT),
        recent: news.slice(0, LIMIT),
      };
    },
  } satisfies StartSourceDefinition;
}
