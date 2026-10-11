import type { AiPlanPermission, AiPlanStepPreview } from '@bemmoly/shared';
import { can, type MockDb } from '../db.ts';
import type { MockResponse, MockRoute } from '../types.ts';
import { workIssuesRoutes } from './work-issues.ts';
import { issueStore } from './work-issue-store.ts';
import { statuses } from './work-issue-detail.ts';
import type { Row } from './work-state.ts';

/*
 * The canned planner behind the mock's ⌘K plans: a few requests the Acme Labs seed can carry
 * out, read and changed through the same mock Work routes the Issue page calls. It stands in
 * for the strong model; the server's real planner reads through the registered tools.
 */

export interface MockStep {
  tool: string;
  args: Record<string, unknown>;
  preview: AiPlanStepPreview;
  permission: AiPlanPermission;
  reason: string | null;
}

export interface MockDraft {
  summary: string | null;
  steps: MockStep[];
}

const compiled = workIssuesRoutes.map((route) => ({
  route,
  regex: new RegExp(`^${route.pattern.replace(/:([a-zA-Z]+)/g, '(?<$1>[^/]+)')}$`),
}));

/** Calls a mock Work route as the signed-in person, as the UI would. */
export function callWork(db: MockDb, method: MockRoute['method'], path: string, body?: unknown) {
  for (const { route, regex } of compiled) {
    const match = route.method === method ? regex.exec(path) : null;
    if (!match) continue;
    const params = { ...match.groups };
    return route.handle({ method, path, query: new URLSearchParams(), body, params }, db);
  }
  return { status: 404 } satisfies MockResponse;
}

export function issueOf(db: MockDb, key: string): Row | null {
  const response = callWork(db, 'GET', `/api/v1/work/issues/${key}`);
  return response.status === 200 ? (response.body as Row) : null;
}

const KEY = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/;
const href = (key: string) => `/work/issue/${key}`;
const nameOf = (row: unknown) => String((row as Row | null)?.['name'] ?? '');

function permission(db: MockDb): Pick<MockStep, 'permission' | 'reason'> {
  return can(db, 'work.issue.edit')
    ? { permission: 'ALLOWED', reason: null }
    : { permission: 'DENIED', reason: "You can't edit issues in Platform Core." };
}

function nextSprint(db: MockDb, projectId: unknown): Row | undefined {
  return issueStore(db).sprints.find(
    (sprint) => sprint['projectId'] === projectId && sprint['state'] === 'future',
  );
}

function moveStep(db: MockDb, issue: Row, sprint: Row | undefined): MockStep {
  const key = String(issue['key']);
  return {
    tool: 'work_move_to_sprint',
    args: { key, sprintId: sprint?.id ?? null },
    preview: {
      target: key,
      change: String(issue['title']),
      field: null,
      from: nameOf(issue['sprint']) || 'Backlog',
      to: sprint ? nameOf(sprint) : 'Backlog',
      href: href(key),
    },
    ...permission(db),
  };
}

function commentStep(db: MockDb, issue: Row, text: string): MockStep {
  const key = String(issue['key']);
  return {
    tool: 'work_add_comment',
    args: { key, text },
    preview: { target: key, change: text, field: 'Comment', from: null, to: null, href: href(key) },
    ...permission(db),
  };
}

/** "move everything blocked by PLT-204 to next sprint", the Command mock's request. */
function blockedBy(db: MockDb, blockerKey: string): MockDraft | null {
  const blocker = issueOf(db, blockerKey);
  if (!blocker) return null;
  const blocked = ((blocker['links'] as Row[] | undefined) ?? [])
    .filter((link) => link['kind'] === 'blocks' && !link['inverse'])
    .map((link) => issueOf(db, String((link['issue'] as Row)['key'])))
    .filter((issue): issue is Row => issue !== null);
  if (blocked.length === 0) {
    return {
      summary: `Nothing is blocked by ${blockerKey}, so there is nothing to move.`,
      steps: [],
    };
  }
  const sprint = nextSprint(db, blocker['projectId']);
  const status = nameOf(blocker['status']).toLowerCase();
  const note = `Moved to ${sprint ? nameOf(sprint) : 'the backlog'}: blocked by ${blockerKey} (${status}).`;
  const from = nameOf(blocked[0]?.['sprint']) || 'the backlog';
  return {
    summary:
      `Move the ${blocked.length} issues blocked by ${blockerKey} from ${from} to ` +
      `${sprint ? nameOf(sprint) : 'the backlog'}, and post a note in each explaining why.`,
    steps: [
      ...blocked.map((issue) => moveStep(db, issue, sprint)),
      ...blocked.map((issue) => commentStep(db, issue, note)),
    ],
  };
}

function assign(db: MockDb, issue: Row, who: string): MockDraft {
  const person = db.users.find((user) => user.name.toLowerCase().startsWith(who.toLowerCase()));
  const key = String(issue['key']);
  if (!person) return { summary: `I couldn't find anyone called “${who}”.`, steps: [] };
  return {
    summary: `Assign ${key} to ${person.name}.`,
    steps: [
      {
        tool: 'work_assign_issue',
        args: { key, assigneeId: person.id },
        preview: {
          target: key,
          change: String(issue['title']),
          field: null,
          from: nameOf(issue['assignee']) || 'Unassigned',
          to: person.name,
          href: href(key),
        },
        ...permission(db),
      },
    ],
  };
}

function close(db: MockDb, issue: Row): MockDraft {
  const done = [...statuses(db).values()].find((status) => status['category'] === 'done');
  const key = String(issue['key']);
  return {
    summary: `Move ${key} to ${nameOf(done)}.`,
    steps: [
      {
        tool: 'work_change_status',
        args: { key, statusId: done?.id ?? null },
        preview: {
          target: key,
          change: String(issue['title']),
          field: null,
          from: nameOf(issue['status']),
          to: nameOf(done),
          href: href(key),
        },
        ...permission(db),
      },
    ],
  };
}

const UNSURE: MockDraft = {
  summary:
    'I couldn’t find a change to make in that. Name an issue, like “move PLT-211 to next sprint”.',
  steps: [],
};

/** Reads the request the way the canned planner understands it. */
export function draftPlan(db: MockDb, request: string): MockDraft {
  const text = request.trim();
  const blocker = /blocked by ([A-Z][A-Z0-9]{1,9}-\d+)/i.exec(text)?.[1]?.toUpperCase();
  if (blocker) return blockedBy(db, blocker) ?? UNSURE;
  const key = KEY.exec(text.toUpperCase())?.[1];
  const issue = key ? issueOf(db, key) : null;
  if (!issue) return UNSURE;
  const who = /\b(?:assign|give)\b.*\bto ([a-z]+)/i.exec(text)?.[1];
  if (who && !/sprint|backlog/i.test(who)) return assign(db, issue, who);
  if (/\b(close|finish|done)\b/i.test(text)) return close(db, issue);
  if (/\bnext sprint\b/i.test(text)) {
    const step = moveStep(db, issue, nextSprint(db, issue['projectId']));
    return { summary: `Move ${key} to ${step.preview.to}.`, steps: [step] };
  }
  if (/\bbacklog\b/i.test(text)) {
    return { summary: `Move ${key} to the backlog.`, steps: [moveStep(db, issue, undefined)] };
  }
  return UNSURE;
}
