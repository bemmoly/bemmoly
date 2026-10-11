import type {
  RoadmapChild,
  RoadmapGroup,
  RoadmapItem,
  RoadmapView,
} from '@bemmoly/module-work/shared';
import { dayOfIso } from '@bemmoly/ui';

/*
 * The Roadmap's rows from the server's view: which items show (search, versions, done, team),
 * how they group (by project, by team or not at all), which epics are open to their issues,
 * and the span of days the axis must cover. Pure, so the screen and its tests agree.
 */

export const ROW_HEIGHT = { group: 32, item: 44, child: 32 } as const;

export interface RoadmapFilters {
  q: string;
  versions: boolean;
  done: boolean;
  teamId: string | null;
}

export type RoadmapRow =
  | {
      kind: 'group';
      id: string;
      label: string;
      count: number;
      open: boolean;
      projectId: string | null;
    }
  | { kind: 'item'; id: string; item: RoadmapItem; open: boolean }
  | { kind: 'child'; id: string; child: RoadmapChild; parent: RoadmapItem };

const isDone = (item: RoadmapItem) =>
  item.kind === 'epic' ? item.statusCategory === 'done' : item.versionStatus === 'released';

export function visibleItems(view: RoadmapView, filters: RoadmapFilters): RoadmapItem[] {
  const q = filters.q.trim().toLowerCase();
  const teamOf = new Map(view.projects.map((project) => [project.id, project.teamId]));
  return view.items.filter(
    (item) =>
      (filters.versions || item.kind !== 'version') &&
      (filters.done || !isDone(item)) &&
      (!filters.teamId || teamOf.get(item.projectId) === filters.teamId) &&
      (!q || item.title.toLowerCase().includes(q) || (item.key ?? '').toLowerCase().includes(q)),
  );
}

interface Group {
  id: string;
  label: string;
  projectId: string | null;
  items: RoadmapItem[];
}

function groupsOf(view: RoadmapView, items: readonly RoadmapItem[], by: RoadmapGroup): Group[] {
  if (by === 'none') return [{ id: 'all', label: '', projectId: null, items: [...items] }];
  if (by === 'project') {
    return view.projects
      .map((project) => ({
        id: `project:${project.id}`,
        label: project.name,
        projectId: project.id,
        items: items.filter((item) => item.projectId === project.id),
      }))
      .filter((group) => group.items.length > 0);
  }
  const teamOf = new Map(view.projects.map((project) => [project.id, project.teamId]));
  const teams = [
    ...view.teams.map((team) => ({ id: team.id, name: team.name })),
    { id: null, name: 'No team' },
  ];
  return teams
    .map((team) => ({
      id: `team:${team.id ?? 'none'}`,
      label: team.name,
      projectId: null,
      items: items.filter((item) => (teamOf.get(item.projectId) ?? null) === team.id),
    }))
    .filter((group) => group.items.length > 0);
}

/** Epics first in their rank order, then versions by release date, as the server sends them. */
export function roadmapRows(
  view: RoadmapView,
  items: readonly RoadmapItem[],
  by: RoadmapGroup,
  openItems: ReadonlySet<string>,
  closedGroups: ReadonlySet<string>,
): RoadmapRow[] {
  const rows: RoadmapRow[] = [];
  for (const group of groupsOf(view, items, by)) {
    const open = !closedGroups.has(group.id);
    if (by !== 'none') {
      rows.push({
        kind: 'group',
        id: group.id,
        label: group.label,
        count: group.items.length,
        open,
        projectId: group.projectId,
      });
    }
    if (!open) continue;
    for (const item of group.items) {
      const expanded = openItems.has(item.id) && item.children.length > 0;
      rows.push({ kind: 'item', id: item.id, item, open: expanded });
      if (!expanded) continue;
      for (const child of item.children) {
        rows.push({ kind: 'child', id: `${item.id}:${child.id}`, child, parent: item });
      }
    }
  }
  return rows;
}

/** Each row's top, and the height of all of them. */
export function rowTops(rows: readonly RoadmapRow[]): { tops: number[]; height: number } {
  const tops: number[] = [];
  let y = 0;
  for (const row of rows) {
    tops.push(y);
    y += ROW_HEIGHT[row.kind];
  }
  return { tops, height: y };
}

const days = (dates: readonly (string | null | undefined)[]) =>
  dates.filter((date): date is string => Boolean(date)).map(dayOfIso);

/**
 * The days the axis covers: every bar and forecast in view, today, and some room either side
 * (two weeks before, eight after), so a dragged bar has somewhere to go.
 */
export function roadmapSpan(items: readonly RoadmapItem[], today: number) {
  const all = items.flatMap((item) =>
    days([
      item.start,
      item.end,
      item.forecast.earliest,
      item.forecast.latest,
      ...item.children.flatMap((child) => [child.startAt, child.dueAt]),
    ]),
  );
  return {
    from: Math.min(today, ...all) - 14,
    to: Math.max(today + 28, ...all) + 56,
  };
}
