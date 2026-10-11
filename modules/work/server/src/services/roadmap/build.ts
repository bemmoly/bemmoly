import type {
  Forecast,
  RoadmapChild,
  RoadmapItem,
  RoadmapProgress,
} from '../../../../shared/roadmap.ts';
import { toDay } from './days.ts';
import type { ForecastItem } from './forecast.ts';
import type { EpicRow, VersionRow, WorkRow } from './load.ts';

/*
 * From rows to roadmap items: each epic and version with its progress, the people on it, the
 * bar it is drawn as and the numbers its forecast needs. Where an item has no stored start or
 * end, the bar takes them from the work itself (its issues' dates; a version starts when the
 * one before it is released), and the stored dates stay null so the screen can say so.
 */

/** Issues listed under an epic on the roadmap; progress always counts all of them. */
export const CHILDREN_SHOWN = 100;

const number = (value: string | null): number | null => (value === null ? null : Number(value));

function progressOf(work: readonly WorkRow[]): RoadmapProgress {
  let done = 0;
  let inProgress = 0;
  let points = 0;
  let pointsDone = 0;
  for (const row of work) {
    const estimate = number(row.estimate) ?? 0;
    points += estimate;
    if (row.category === 'done') {
      done += 1;
      pointsDone += estimate;
    } else if (row.category === 'in_progress') inProgress += 1;
  }
  return { total: work.length, done, inProgress, points, pointsDone };
}

/** People with open work in it, the one with most open issues first. */
function peopleOf(work: readonly WorkRow[]): string[] {
  const counts = new Map<string, number>();
  for (const row of work) {
    if (row.category === 'done' || !row.assignee_id) continue;
    counts.set(row.assignee_id, (counts.get(row.assignee_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([id]) => id);
}

const toChild = (row: WorkRow): RoadmapChild => ({
  id: row.id,
  key: row.key,
  title: row.title,
  typeId: row.type_id,
  statusName: row.status_name,
  statusCategory: row.category,
  assigneeId: row.assignee_id,
  estimate: number(row.estimate),
  startAt: row.start_at,
  dueAt: row.due_at,
});

const earliest = (dates: readonly (string | null)[]) =>
  dates.filter((date): date is string => date !== null).sort()[0] ?? null;
const latest = (dates: readonly (string | null)[]) =>
  dates
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1) ?? null;

export interface Built {
  item: Omit<RoadmapItem, 'forecast' | 'canSchedule'>;
  input: ForecastItem;
}

function forecastInput(
  base: Pick<ForecastItem, 'id' | 'kind' | 'projectId' | 'title' | 'done'>,
  work: readonly WorkRow[],
  dates: { startAt: string | null; targetAt: string | null },
  today: number,
): ForecastItem {
  const open = work.filter((row) => row.category !== 'done');
  const startDay = dates.startAt ? toDay(dates.startAt) : null;
  return {
    ...base,
    totalIssues: work.length,
    remainingIssues: open.length,
    remainingPoints: open.reduce((sum, row) => sum + (number(row.estimate) ?? 0), 0),
    unestimated: open.filter((row) => row.estimate === null).length,
    started:
      work.some((row) => row.category !== 'todo') || (startDay !== null && startDay <= today),
    startDay,
    targetDay: dates.targetAt ? toDay(dates.targetAt) : null,
    sharedWith: 0,
  };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const shaped = (value: string | null, shape: RegExp) =>
  value !== null && shape.test(value) ? value : null;

/**
 * An epic's target is its Target date field when it has a value or the project defines one,
 * else its due date; `targetInField` says the project defines the field.
 */
export function buildEpic(
  epic: EpicRow,
  work: readonly WorkRow[],
  today: number,
  targetInField: boolean,
): Built {
  const field = shaped(epic.target_date, DATE);
  const useField = field !== null || targetInField;
  const target = useField ? (field ?? epic.due_at) : epic.due_at;
  const start = epic.start_at ?? earliest(work.map((row) => row.start_at));
  const end = target ?? latest(work.map((row) => row.due_at));
  return {
    item: {
      id: epic.id,
      kind: 'epic',
      projectId: epic.project_id,
      key: epic.key,
      title: epic.title,
      color: epic.color,
      statusCategory: epic.category,
      versionStatus: null,
      startAt: epic.start_at,
      endAt: target,
      targetField: useField ? 'target_date' : 'dueAt',
      ownerId: shaped(epic.owner_id, UUID),
      start: start && end && start > end ? null : start,
      end,
      progress: progressOf(work),
      assigneeIds: peopleOf(work),
      children: work.slice(0, CHILDREN_SHOWN).map(toChild),
    },
    input: forecastInput(
      {
        id: epic.id,
        kind: 'epic',
        projectId: epic.project_id,
        title: epic.title,
        done: epic.category === 'done',
      },
      work,
      { startAt: start, targetAt: target },
      today,
    ),
  };
}

export function buildVersion(
  version: VersionRow,
  previousRelease: string | null,
  work: readonly WorkRow[],
  today: number,
): Built {
  const start = version.start_at ?? previousRelease;
  return {
    item: {
      id: version.id,
      kind: 'version',
      projectId: version.project_id,
      key: null,
      title: version.name,
      color: null,
      statusCategory: null,
      versionStatus: version.status,
      startAt: version.start_at,
      endAt: version.release_at,
      targetField: 'releaseAt',
      ownerId: null,
      start: start && version.release_at && start > version.release_at ? null : start,
      end: version.release_at,
      progress: progressOf(work),
      assigneeIds: peopleOf(work),
      children: [],
    },
    input: forecastInput(
      {
        id: version.id,
        kind: 'version',
        projectId: version.project_id,
        title: version.name,
        done: version.status === 'released',
      },
      work,
      { startAt: version.start_at, targetAt: version.release_at },
      today,
    ),
  };
}

/**
 * Epics in flight share their project's pace: each gets an equal part, so three at once
 * each finish at a third of the team's speed. Versions collect work across epics and keep
 * the whole pace.
 */
export function shareTheTeam(built: readonly Built[]): ForecastItem[] {
  const inFlight = new Map<string, number>();
  for (const { input } of built) {
    if (input.kind !== 'epic' || input.done || !input.started || input.remainingIssues === 0)
      continue;
    inFlight.set(input.projectId, (inFlight.get(input.projectId) ?? 0) + 1);
  }
  return built.map(({ input }) =>
    input.kind === 'epic'
      ? { ...input, sharedWith: Math.max(0, (inFlight.get(input.projectId) ?? 0) - 1) }
      : input,
  );
}

/** The forecast for an item nothing could be computed for; never shown in practice. */
export const missingForecast = (item: ForecastItem): Forecast => ({
  state: 'no_forecast',
  basis: null,
  remainingIssues: item.remainingIssues,
  remainingPoints: null,
  likely: null,
  earliest: null,
  latest: null,
  confidence: null,
  daysLate: null,
  waitsOn: [],
  explanation: [],
});
