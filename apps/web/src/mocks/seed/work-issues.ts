import { USER_IDS } from './people.ts';
import { ago, uid } from './time.ts';
import { STATUS_IDS, WORK_IDS, type StatusName } from './work-settings.ts';
import { TYPE_IDS } from './work-types.ts';

/*
 * The Issue mock as data: PLT-204 with its subtasks, links, comments, history and work log,
 * the issues around it, a second project for the list, and the labels, versions and sprints
 * the sidebar picks from. Shapes follow the work module's shared schemas, typed loosely.
 */

export type Row = Record<string, unknown> & { id: string };

const P = WORK_IDS.project;
const stamp = (minutes: number) => ({ createdAt: ago(minutes), updatedAt: ago(minutes) });
const DAY = 60 * 24;

export const LABEL_IDS = { auth: uid(0xb01), infra: uid(0xb02), customer: uid(0xb03) };
export const VERSION_IDS = { v13: uid(0xb11), v14: uid(0xb12) };
export const SPRINT_IDS = { s14: uid(0xb21), s15: uid(0xb22) };

export function seedLabels(): Row[] {
  return Object.entries(LABEL_IDS).map(([name, id]) => ({
    id,
    projectId: P,
    name,
    color: null,
    ...stamp(40 * DAY),
  }));
}

export function seedVersions(): Row[] {
  return [
    ['v1.3.0', VERSION_IDS.v13, 'unreleased'],
    ['v1.4.0', VERSION_IDS.v14, 'unreleased'],
  ].map(([name, id, status]) => ({
    id: id ?? '',
    projectId: P,
    name,
    description: null,
    status,
    releaseAt: null,
    releasedAt: null,
    ...stamp(30 * DAY),
  }));
}

export function seedSprints(): Row[] {
  return [
    ['PLT Sprint 14', SPRINT_IDS.s14, 'active'],
    ['PLT Sprint 15', SPRINT_IDS.s15, 'future'],
  ].map(([name, id, state], index) => ({
    id: id ?? '',
    projectId: P,
    name,
    goal: index === 0 ? 'Sessions on Postgres' : null,
    state,
    startsAt: state === 'active' ? ago(5 * DAY) : null,
    endsAt: null,
    capacityPoints: null,
    completedSnapshot: null,
    startedAt: state === 'active' ? ago(5 * DAY) : null,
    closedAt: null,
    ...stamp(20 * DAY),
  }));
}

export function seedProjects(): Row[] {
  return [
    {
      id: uid(0xb31),
      key: 'MOB',
      name: 'Mobile App',
      description: 'iOS and Android clients',
      teamId: null,
      method: 'kanban',
      schemeOverrides: {},
      defaultSpaceId: null,
      archivedAt: null,
      ...stamp(60 * DAY),
    },
  ];
}

type IssueSeed = [number, string, string, StatusName, string | null, string | null, number];

/** number, type, title, status, assignee, parent number, minutes ago. */
const ISSUES: IssueSeed[] = [
  [190, 'epic', 'Auth service', 'In progress', 'rohan', null, 30 * DAY],
  [204, 'story', 'Session store migration to Postgres', 'Code review', 'aisha', '190', 21 * DAY],
  [205, 'subtask', 'Schema for sessions table', 'Done', 'aisha', '204', 20 * DAY],
  [206, 'subtask', 'Dual-write path', 'Done', 'aisha', '204', 20 * DAY],
  [207, 'subtask', 'Backfill job + verification', 'Code review', 'aisha', '204', 19 * DAY],
  [208, 'subtask', 'Remove Redis fallback', 'Selected', 'jonas', '204', 19 * DAY],
  [211, 'story', 'Session cleanup background job', 'Selected', 'priya', '190', 9 * DAY],
  [218, 'story', 'Rotate service tokens on every deploy', 'In progress', 'priya', '190', 8 * DAY],
  [219, 'task', 'Remove legacy cookie path from monolith', 'Backlog', 'jonas', '190', 7 * DAY],
];

export const issueId = (number: number) => uid(0xc00 + number);

const paragraph = (...content: Row[] | Array<Record<string, unknown>>) => ({
  type: 'paragraph',
  content,
});
const text = (value: string, marks?: string[]) => ({
  type: 'text',
  text: value,
  ...(marks ? { marks: marks.map((type) => ({ type })) } : {}),
});
const doc = (...content: Array<Record<string, unknown>>) => ({ type: 'doc', content });
const bullets = (...items: string[]) => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [paragraph(text(item))] })),
});

const DESCRIPTION = doc(
  paragraph(
    text(
      'Move session storage from the Redis cluster to Postgres so sessions survive cache evictions and can be queried for audit. Dual-write during migration, then cut reads over behind the ',
    ),
    text('auth_pg_sessions', ['code']),
    text(' flag.'),
  ),
);

const CRITERIA = doc(
  bullets(
    'Zero session loss during cutover (verified by synthetic login monitor)',
    'p95 session read under 8 ms from Postgres',
    'Rollback is a flag flip; Redis stays warm for 7 days',
    'Runbook updated: Session migration runbook',
  ),
);

export function seedIssues(): Row[] {
  return ISSUES.map(([number, type, title, status, who, parent, minutes], rank) => {
    const main = number === 204;
    const description = main ? DESCRIPTION : null;
    return {
      id: issueId(number),
      projectId: P,
      number,
      key: `PLT-${number}`,
      typeId: TYPE_IDS[type] ?? '',
      title,
      description,
      descriptionText: '',
      statusId: STATUS_IDS[status],
      priority: main ? 'highest' : 'medium',
      assigneeId: who ? USER_IDS[who as keyof typeof USER_IDS] : null,
      reporterId: USER_IDS.rohan,
      parentId: parent ? issueId(Number(parent)) : null,
      sprintId: main || type === 'subtask' ? SPRINT_IDS.s14 : null,
      estimate: main ? 5 : type === 'story' ? 3 : null,
      dueAt: main ? '2026-10-07' : null,
      fixVersionId: main ? VERSION_IDS.v13 : null,
      componentId: null,
      customFields: main ? { environment: 'production', acceptance_criteria: CRITERIA } : {},
      labelIds: main ? [LABEL_IDS.auth, LABEL_IDS.infra] : [],
      rank: `m${'bcdefghijk'[rank] ?? 'z'}`,
      statusChangedAt: ago(3 * DAY),
      resolvedAt: status === 'Done' ? ago(2 * DAY) : null,
      deletedAt: null,
      ...stamp(minutes),
      updatedAt: main ? ago(180) : ago(minutes),
    };
  });
}

/** The highest number taken so far, so a new issue continues the sequence. */
export const LAST_NUMBER = 226;

export function seedLinks(): Row[] {
  const link = (n: number, target: number, kind: string) => ({
    id: uid(0xd00 + n),
    sourceId: issueId(204),
    targetId: issueId(target),
    kind,
    createdBy: USER_IDS.aisha,
    createdAt: ago(4 * DAY),
  });
  return [link(1, 211, 'blocks'), link(2, 219, 'blocks'), link(3, 218, 'relates')];
}

export function seedComments(): Row[] {
  const comment = (n: number, who: keyof typeof USER_IDS, body: string, minutes: number) => ({
    id: uid(0xe00 + n),
    targetKind: 'issue',
    targetId: issueId(204),
    parentId: null as string | null,
    authorId: USER_IDS[who],
    body: doc(paragraph(text(body))),
    bodyText: body,
    reactions: {} as Record<string, string[]>,
    aiRunId: null,
    editedAt: null,
    ...stamp(minutes),
  });
  const first = comment(
    1,
    'aisha',
    'Backfill finished on staging, 0 mismatches across 2.1M rows. Ready for a second pair of eyes on #4821.',
    180,
  );
  first.reactions = { '👍': [USER_IDS.rohan, USER_IDS.jonas], '🎉': [USER_IDS.priya] };
  const flag = comment(
    3,
    'priya',
    'Flag TTL in the RFC says 15 min, the code says 30. Can we align before cutover?',
    3 * DAY,
  );
  const reply = comment(4, 'aisha', 'Code is right; I will fix the RFC today.', 3 * DAY - 90);
  reply.parentId = flag.id;
  return [
    flag,
    reply,
    comment(2, 'jonas', "Flagging: PLT-211 and PLT-219 can't start until this merges.", DAY),
    first,
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function seedHistory(): Row[] {
  const entry = (n: number, who: string, field: string, from: unknown, to: unknown, m: number) => ({
    id: uid(0xf00 + n),
    issueId: issueId(204),
    actorId: USER_IDS[who as keyof typeof USER_IDS],
    field,
    from,
    to,
    aiPlanId: null,
    createdAt: ago(m),
  });
  return [
    entry(1, 'aisha', 'statusId', STATUS_IDS['In progress'], STATUS_IDS['Code review'], 3 * DAY),
    entry(2, 'rohan', 'priority', 'high', 'highest', 10 * DAY),
  ];
}

export function seedWorkLogs(): Row[] {
  return [
    [1, 240, 4 * DAY],
    [2, 360, 11 * DAY],
  ].map(([n = 0, minutes, when = 0]) => ({
    id: uid(0xf80 + n),
    issueId: issueId(204),
    userId: USER_IDS.aisha,
    minutes,
    startedAt: ago(when),
    note: null,
    ...stamp(when),
  }));
}

export const WATCHER_IDS = ['rohan', 'aisha', 'jonas', 'priya', 'lena', 'maya'].map(
  (who) => USER_IDS[who as keyof typeof USER_IDS],
);
