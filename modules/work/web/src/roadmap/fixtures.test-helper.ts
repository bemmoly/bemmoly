import type { Forecast, RoadmapItem, RoadmapView } from '@bemmoly/module-work/shared';

/*
 * A roadmap the screen's tests share, on the Roadmap mock's Monday 5 October 2026: Platform
 * Core with Billing v2 running late and holding up Observability, Auth service on track with
 * two issues, a done epic and a version; Mobile App with one epic in another team.
 */

const id = (n: number) => `018f0000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;

export const IDS = {
  plt: id(1),
  mob: id(2),
  platform: id(3),
  mobile: id(4),
  billing: id(10),
  auth: id(11),
  observability: id(12),
  done: id(13),
  version: id(14),
  offline: id(15),
} as const;

const forecast = (overrides: Partial<Forecast> = {}): Forecast => ({
  state: 'on_track',
  basis: 'throughput',
  remainingIssues: 4,
  remainingPoints: null,
  likely: '2026-10-20',
  earliest: '2026-10-16',
  latest: '2026-10-24',
  confidence: 'medium',
  daysLate: -4,
  waitsOn: [],
  explanation: [
    'Over the last 8 weeks, Platform Core finished 3 to 7 issues a week, 4.6 on average.',
  ],
  ...overrides,
});

export function item(
  overrides: Partial<RoadmapItem> & Pick<RoadmapItem, 'id' | 'title'>,
): RoadmapItem {
  return {
    kind: 'epic',
    projectId: IDS.plt,
    key: null,
    color: 'epic-2',
    statusCategory: 'in_progress',
    versionStatus: null,
    startAt: '2026-09-22',
    endAt: '2026-10-21',
    targetField: 'target_date',
    ownerId: null,
    start: '2026-09-22',
    end: '2026-10-21',
    progress: { total: 12, done: 4, inProgress: 2, points: 30, pointsDone: 10 },
    assigneeIds: [],
    canSchedule: true,
    forecast: forecast(),
    children: [],
    ...overrides,
  };
}

export function roadmapView(): RoadmapView {
  return {
    today: '2026-10-05',
    projects: [
      {
        id: IDS.plt,
        key: 'PLT',
        name: 'Platform Core',
        teamId: IDS.platform,
        method: 'scrum',
        history: {
          basis: 'throughput',
          unit: 'issues',
          samples: [3, 7, 2, 5, 6, 4, 0, 5],
          periodDays: 7,
        },
      },
      {
        id: IDS.mob,
        key: 'MOB',
        name: 'Mobile App',
        teamId: IDS.mobile,
        method: 'kanban',
        history: null,
      },
    ],
    teams: [
      { id: IDS.mobile, name: 'Mobile' },
      { id: IDS.platform, name: 'Platform' },
    ],
    items: [
      item({
        id: IDS.billing,
        key: 'PLT-150',
        title: 'Billing v2',
        forecast: forecast({
          state: 'late',
          likely: '2026-11-01',
          earliest: '2026-10-27',
          latest: '2026-11-08',
          daysLate: 11,
        }),
      }),
      item({
        id: IDS.auth,
        key: 'PLT-190',
        title: 'Auth service',
        color: 'epic-1',
        startAt: '2026-09-08',
        start: '2026-09-08',
        endAt: '2026-10-30',
        end: '2026-10-30',
        children: [
          {
            id: id(20),
            key: 'PLT-204',
            title: 'Session store migration',
            typeId: id(30),
            statusName: 'In review',
            statusCategory: 'in_progress',
            assigneeId: null,
            estimate: 5,
            startAt: '2026-09-15',
            dueAt: '2026-10-05',
          },
          {
            id: id(21),
            key: 'PLT-211',
            title: 'Session cleanup job',
            typeId: id(30),
            statusName: 'To do',
            statusCategory: 'todo',
            assigneeId: null,
            estimate: 3,
            startAt: null,
            dueAt: null,
          },
        ],
      }),
      item({
        id: IDS.observability,
        key: 'PLT-240',
        title: 'Observability',
        color: 'epic-3',
        startAt: '2026-10-21',
        start: '2026-10-21',
        endAt: '2026-11-25',
        end: '2026-11-25',
        forecast: forecast({
          waitsOn: [IDS.billing],
          likely: '2026-11-20',
          earliest: '2026-11-12',
          latest: '2026-11-24',
        }),
      }),
      item({
        id: IDS.done,
        key: 'PLT-160',
        title: 'Self-serve onboarding',
        statusCategory: 'done',
        forecast: forecast({ state: 'done', likely: null, earliest: null, latest: null }),
      }),
      item({
        id: IDS.version,
        kind: 'version',
        key: null,
        title: '1.4',
        color: null,
        statusCategory: null,
        versionStatus: 'unreleased',
        targetField: 'releaseAt',
        canSchedule: false,
        startAt: null,
        start: '2026-10-12',
        endAt: '2026-11-02',
        end: '2026-11-02',
      }),
      item({
        id: IDS.offline,
        projectId: IDS.mob,
        key: 'MOB-1',
        title: 'Offline mode',
        color: 'epic-5',
        forecast: forecast({
          state: 'no_forecast',
          likely: null,
          earliest: null,
          latest: null,
          explanation: ['Not enough finished work to forecast yet.'],
        }),
      }),
    ],
    dependencies: [
      {
        id: id(40),
        fromId: IDS.billing,
        toId: IDS.observability,
        via: 'epic',
        links: 1,
        conflict: false,
      },
    ],
    computedAt: '2026-10-05T09:00:00.000Z',
  };
}
