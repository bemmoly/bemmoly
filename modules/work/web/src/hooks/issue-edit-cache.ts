import { queryKeys } from '@bemmoly/api-client';
import type { Backlog, BoardView, IssueDetail } from '@bemmoly/module-work/shared';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { backlogKeys } from '../api/index.ts';
import { workKeys } from '../shared/keys.ts';
import { findIssue, patchBacklog, revertBacklog } from './issue-edit-backlog.ts';
import { patchBoardView, revertBoardView } from './issue-edit-board.ts';
import { patchIssueDetail, revertIssueDetail, type DetailNames } from './issue-edit-detail.ts';
import { previousOf, type QuickPatch } from './issue-edit-patch.ts';

/*
 * One quick edit painted into every cache that shows the issue, in the same frame: each cached
 * board view, each cached backlog and the issue's own page. What comes back takes the edit out
 * again for this issue alone, should the server refuse it.
 */

export interface PaintedEdit {
  /** Takes the edit back wherever it was painted, on the fields that still hold it. */
  restore(): void;
  /** The values the edit replaced, for Undo; null when no cache knew them all. */
  before: QuickPatch | null;
}

/** The caches a quick edit paints; their reads in flight are cancelled first. */
export const editedCaches = (key: string): QueryKey[] => [
  workKeys.boardViews(),
  backlogKeys.backlogs(),
  workKeys.issue(key),
];

interface Person {
  id: string;
  name: string;
  email?: string;
}

const isPerson = (value: unknown): value is Person =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Person).id === 'string' &&
  typeof (value as Person).name === 'string';

/** Someone the session already knows: the signed-in person or a cached people list. */
function knownPerson(client: QueryClient, id: string): Person | undefined {
  const me = client.getQueryData<{ user?: unknown }>(queryKeys.me())?.user;
  if (isPerson(me) && me.id === id) return me;
  for (const [, data] of client.getQueriesData<{ items?: unknown }>({
    queryKey: queryKeys.users.all(),
  })) {
    const found = Array.isArray(data?.items)
      ? data.items.find((item: unknown) => isPerson(item) && item.id === id)
      : undefined;
    if (isPerson(found)) return found;
  }
  return undefined;
}

/** The names the issue page prints for the edit's assignee and sprint, where they are known. */
function namesFor(client: QueryClient, patch: QuickPatch): DetailNames {
  const names: DetailNames = {};
  if (patch.assigneeId) {
    const person = knownPerson(client, patch.assigneeId);
    if (person) names.assignee = { id: person.id, name: person.name, email: person.email ?? '' };
  }
  if (patch.sprintId) {
    for (const [, backlog] of client.getQueriesData<Backlog>({
      queryKey: backlogKeys.backlogs(),
    })) {
      const sprint = backlog?.sprints.find((entry) => entry.sprint.id === patch.sprintId)?.sprint;
      if (sprint) names.sprint = { id: sprint.id, name: sprint.name, state: sprint.state };
    }
  }
  return names;
}

export function paintEdit(client: QueryClient, key: string, patch: QuickPatch): PaintedEdit {
  const undo: Array<() => void> = [];
  let before: QuickPatch | null = null;
  const learn = (entry: Parameters<typeof previousOf>[0]) => {
    if (before === null) before = previousOf(entry, patch);
  };

  const detailKey = workKeys.issue(key);
  const detail = client.getQueryData<IssueDetail>(detailKey);
  if (detail) {
    learn(detail);
    client.setQueryData(detailKey, patchIssueDetail(detail, patch, namesFor(client, patch)));
    undo.push(() =>
      client.setQueryData<IssueDetail>(detailKey, (now) =>
        now ? revertIssueDetail(now, detail, patch) : now,
      ),
    );
  }

  for (const [queryKey, backlog] of client.getQueriesData<Backlog>({
    queryKey: backlogKeys.backlogs(),
  })) {
    const issue = backlog ? findIssue(backlog, key) : undefined;
    if (!backlog || !issue) continue;
    learn(issue);
    client.setQueryData(queryKey, patchBacklog(backlog, key, patch));
    undo.push(() =>
      client.setQueryData<Backlog>(queryKey, (now) =>
        now ? revertBacklog(now, issue, patch) : now,
      ),
    );
  }

  for (const [queryKey, view] of client.getQueriesData<BoardView>({
    queryKey: workKeys.boardViews(),
  })) {
    const card = view?.cards.find((entry) => entry.key === key);
    if (!view || !card) continue;
    learn(card);
    client.setQueryData(queryKey, patchBoardView(view, key, patch));
    undo.push(() =>
      client.setQueryData<BoardView>(queryKey, (now) =>
        now ? revertBoardView(now, card, patch) : now,
      ),
    );
  }

  return { restore: () => undo.forEach((step) => step()), before };
}
