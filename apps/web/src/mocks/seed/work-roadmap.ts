import { BOARD_IDS } from './work-board.ts';
import { USER_IDS } from './people.ts';
import { ago, dayFromToday, uid } from './time.ts';
import { VERSION_IDS, type Row } from './work-issues.ts';
import { STATUS_IDS, WORK_IDS, type StatusName } from './work-settings.ts';
import { TYPE_IDS } from './work-types.ts';

/*
 * The Roadmap mock as data, laid over the other seeds by issue key: Platform Core's epics with
 * the mock's start and target dates (counted from today, so the demo never goes stale) and
 * owners, Mobile App's two epics so the roadmap has a second project to group by, the
 * "blocks" links between epics, which issues each version ships, and how much each team
 * finished a week over the last eight.
 */

/** [key, start, target, owner]: days from today, so Billing v2 runs late as in the mock. */
const PLAN: Array<[string, number, number, keyof typeof USER_IDS]> = [
  ['PLT-190', -27, 21, 'priya'],
  ['PLT-150', -13, 4, 'lena'],
  ['PLT-160', -34, 28, 'jonas'],
  ['PLT-240', 16, 51, 'rohan'],
  ['MOB-1', -6, 30, 'aisha'],
  ['MOB-6', 36, 74, 'jonas'],
];

export const MOBILE_PROJECT = uid(0xb31);

/** Mobile App's epics and their issues: [number, type, title, status, parent number]. */
const MOBILE: Array<[number, string, string, StatusName, number | null]> = [
  [1, 'epic', 'Offline mode', 'In progress', null],
  [2, 'story', 'Queue edits while offline', 'Done', 1],
  [3, 'story', 'Sync conflicts screen', 'In progress', 1],
  [4, 'task', 'Background sync on iOS', 'Selected', 1],
  [5, 'task', 'Background sync on Android', 'Selected', 1],
  [6, 'epic', 'Push notifications v2', 'Backlog', null],
  [7, 'story', 'Notification preferences per project', 'Backlog', 6],
  [8, 'task', 'Rich notifications with actions', 'Backlog', 6],
  [9, 'task', 'Quiet hours', 'Backlog', 6],
];

const mobileId = (number: number) => uid(0xf00 + number);

/** Which version each issue ships in. */
const SHIPS: Array<[string, string]> = [
  ['PLT-211', VERSION_IDS.v13],
  ['PLT-218', VERSION_IDS.v13],
  ['PLT-219', VERSION_IDS.v13],
  ['PLT-222', VERSION_IDS.v13],
  ['PLT-226', VERSION_IDS.v13],
  ['PLT-230', VERSION_IDS.v14],
  ['PLT-231', VERSION_IDS.v14],
  ['PLT-225', VERSION_IDS.v14],
  ['PLT-241', VERSION_IDS.v14],
];

export function seedRoadmapIssues(): Row[] {
  const planned = PLAN.map(([key, start, target, owner]) => ({
    id: `plan:${key}`,
    key,
    startAt: dayFromToday(start),
    customFields: { target_date: dayFromToday(target), owner: USER_IDS[owner] },
  }));
  const mobile = MOBILE.map(([number, type, title, status, parent], index) => ({
    id: mobileId(number),
    projectId: MOBILE_PROJECT,
    key: `MOB-${number}`,
    title,
    typeId: TYPE_IDS[type] ?? '',
    statusId: STATUS_IDS[status],
    parentId: parent === null ? null : mobileId(parent),
    assigneeId: type === 'epic' ? null : [USER_IDS.aisha, USER_IDS.jonas][index % 2],
    estimate: type === 'epic' ? null : 3,
    rank: `y${String.fromCharCode(98 + index)}`,
    reporterId: USER_IDS.rohan,
    createdAt: ago(60 * 24 * 12),
    updatedAt: ago(60 * 24 * 2),
    statusChangedAt: ago(60 * 24 * 2),
    // The sync conflicts screen runs past Offline mode's target, so the roadmap and the board
    // show the epic date warning and its fixes.
    ...(number === 3 ? { startAt: dayFromToday(20), dueAt: dayFromToday(38) } : {}),
  }));
  const shipping = SHIPS.map(([key, fixVersionId]) => ({ id: `ship:${key}`, key, fixVersionId }));
  return [...mobile, ...planned, ...shipping];
}

/**
 * Billing v2 holds up Observability, offline mode waits on the auth service, and a Mobile card
 * blocks one under Self-serve onboarding: a dependency across teams below the epics.
 */
export function seedRoadmapLinks(issues: readonly Row[]): Row[] {
  const id = (key: string) => issues.find((issue) => issue['key'] === key)?.id ?? '';
  const under = (key: string) => issues.find((issue) => issue['parentId'] === id(key))?.id ?? '';
  return [
    [id('PLT-150'), id('PLT-240')],
    [id('PLT-190'), id('MOB-1')],
    [id('MOB-3'), under('PLT-240')],
  ].map(([source = '', target = ''], n) => ({
    id: uid(0xd80 + n),
    sourceId: source,
    targetId: target,
    kind: 'blocks',
    createdBy: USER_IDS.lena,
    createdAt: ago(60 * 24 * 10),
  }));
}

/** The issue mock's versions with the roadmap's planned dates. */
export function datedVersions(versions: Row[]): Row[] {
  const dates: Record<string, { startAt: string; releaseAt: string }> = {
    [VERSION_IDS.v13]: { startAt: dayFromToday(-16), releaseAt: dayFromToday(12) },
    [VERSION_IDS.v14]: { startAt: dayFromToday(12), releaseAt: dayFromToday(47) },
  };
  return versions.map((version) => ({ ...version, ...dates[version.id] }));
}

/**
 * Issues finished per week over the last eight, oldest first: what the Board's flow metrics
 * would say for each project. A project not listed has too little history to forecast.
 */
export const THROUGHPUT: Record<string, readonly number[]> = {
  [WORK_IDS.project]: [11, 9, 13, 10, 12, 8, 12, 11],
  [BOARD_IDS.supProject]: [22, 25, 19, 28, 24, 21, 26, 23],
  [MOBILE_PROJECT]: [3, 2, 4, 3, 1, 3, 2, 4],
};
