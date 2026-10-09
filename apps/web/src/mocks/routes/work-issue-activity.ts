import { emit, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, invalid, notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import { workState, type Row } from './work-state.ts';

/** The rows of the Issue page beside the kernel's mock database. */
export interface IssuesState {
  projects: Row[];
  issues: Row[];
  links: Row[];
  comments: Row[];
  history: Row[];
  workLogs: Row[];
  watchers: Record<string, string[]>;
  labels: Row[];
  versions: Row[];
  sprints: Row[];
  counters: Record<string, number>;
}

interface Deps {
  state: (db: MockDb) => IssuesState;
  issueOf: (db: MockDb, key?: string) => Row | undefined;
  statuses: (db: MockDb) => Map<string, Row>;
}

const plain = (doc: unknown): string =>
  JSON.stringify(doc ?? '')
    .match(/"text":"([^"]*)"/g)
    ?.map((part) => part.slice(8, -1))
    .join(' ') ?? '';

/**
 * Everything around one issue: transitions, watchers, work logs, history, comments with
 * reactions, links and the key search the link picker uses. Kept apart from the issue
 * routes so neither file passes the size limit.
 */
export function issueActivityRoutes({ state, issueOf, statuses }: Deps): MockRoute[] {
  const keyed =
    (handle: (issue: Row, request: MockRequest, db: MockDb) => ReturnType<MockRoute['handle']>) =>
    (request: MockRequest, db: MockDb) => {
      const issue = issueOf(db, request.params['key']);
      return issue ? handle(issue, request, db) : notFound('Issue');
    };
  const comment = (db: MockDb, id = '') => state(db).comments.find((row) => row.id === id);
  const now = () => new Date().toISOString();

  return [
    {
      method: 'GET',
      pattern: '/api/v1/work/issues/:key/transitions',
      handle: keyed((issue, _, db) => {
        const flows = workState(db).workflows;
        const flow =
          flows.find((row) => row['projectId'] === issue['projectId']) ??
          flows.find((row) => !row['projectId']);
        const named = statuses(db);
        const items = ((flow?.['transitions'] as Row[]) ?? [])
          .filter((t) => t['fromStatusId'] === issue['statusId'] || t['fromStatusId'] === null)
          .filter((t) => t['toStatusId'] !== issue['statusId'])
          .map((t) => {
            const to = named.get(String(t['toStatusId']));
            const needsPr = (t['rules'] as { conditions: Row[] }).conditions.length > 0;
            return {
              id: t.id,
              name: t['name'],
              toStatusId: t['toStatusId'],
              toStatusName: to?.['name'],
              toStatusCategory: to?.['category'],
              available: !needsPr,
              blockedBy: needsPr ? ['A pull request must be linked'] : [],
            };
          });
        return ok({ items });
      }),
    },
    {
      method: 'GET',
      pattern: '/api/v1/work/issues/:key/watchers',
      handle: keyed((issue, _, db) =>
        ok({
          items: (state(db).watchers[issue.id] ?? []).map((userId) => ({
            id: newId(),
            targetKind: 'issue',
            targetId: issue.id,
            userId,
            createdAt: now(),
          })),
        }),
      ),
    },
    {
      method: 'PUT',
      pattern: '/api/v1/work/issues/:key/watchers',
      handle: keyed((issue, request, db) => {
        const me = db.signedInAs ?? '';
        const list = (state(db).watchers[issue.id] ?? []).filter((id) => id !== me);
        state(db).watchers[issue.id] = bodyOf<{ watching: boolean }>(request).watching
          ? [...list, me]
          : list;
        return ok();
      }),
    },
    {
      method: 'GET',
      pattern: '/api/v1/work/issues/:key/work-logs',
      handle: keyed((issue, _, db) =>
        ok({ items: state(db).workLogs.filter((row) => row['issueId'] === issue.id) }),
      ),
    },
    {
      method: 'POST',
      pattern: '/api/v1/work/issues/:key/work-logs',
      handle: keyed((issue, request, db) => {
        const body = bodyOf<{ minutes: number; startedAt: string; note: string }>(request);
        if (!body.minutes || body.minutes < 1) return invalid('minutes', 'Log at least a minute.');
        const row = {
          id: newId(),
          issueId: issue.id,
          userId: db.signedInAs,
          minutes: body.minutes,
          startedAt: body.startedAt ?? now(),
          note: body.note ?? null,
          createdAt: now(),
          updatedAt: now(),
        };
        state(db).workLogs.push(row);
        return ok(row, 201);
      }),
    },
    {
      method: 'GET',
      pattern: '/api/v1/work/issues/:key/history',
      handle: keyed((issue, _, db) =>
        ok({
          items: state(db).history.filter((row) => row['issueId'] === issue.id),
          nextCursor: null,
        }),
      ),
    },
    {
      method: 'GET',
      pattern: '/api/v1/work/issues/:key/comments',
      handle: keyed((issue, _, db) =>
        ok({
          items: state(db).comments.filter((row) => row['targetId'] === issue.id),
          nextCursor: null,
        }),
      ),
    },
    {
      method: 'POST',
      pattern: '/api/v1/work/issues/:key/comments',
      handle: keyed((issue, request, db) => {
        const body = bodyOf<{ body: unknown; parentId: string }>(request);
        const text = plain(body.body).trim();
        if (!text) return invalid('body', 'Write something first.');
        const row = {
          id: newId(),
          targetKind: 'issue',
          targetId: issue.id,
          parentId: body.parentId ?? null,
          authorId: db.signedInAs,
          body: body.body,
          bodyText: text,
          reactions: {},
          aiRunId: null,
          editedAt: null,
          createdAt: now(),
          updatedAt: now(),
        };
        state(db).comments.push(row);
        emit(db, 'work.comment.created', [issue.id]);
        return ok(row, 201);
      }),
    },
    {
      method: 'PATCH',
      pattern: '/api/v1/work/comments/:id',
      handle: (request, db) => {
        const row = comment(db, request.params['id']);
        if (!row) return notFound('Comment');
        const body = bodyOf<{ body: unknown }>(request).body;
        Object.assign(row, { body, bodyText: plain(body), editedAt: now(), updatedAt: now() });
        return ok(row);
      },
    },
    {
      method: 'PUT',
      pattern: '/api/v1/work/comments/:id/reactions',
      handle: (request, db) => {
        const row = comment(db, request.params['id']);
        if (!row) return notFound('Comment');
        const { reaction = '', on = true } = bodyOf<{ reaction: string; on: boolean }>(request);
        const me = db.signedInAs ?? '';
        const reactions = { ...(row['reactions'] as Record<string, string[]>) };
        const people = (reactions[reaction] ?? []).filter((id) => id !== me);
        if (on) people.push(me);
        if (people.length) reactions[reaction] = people;
        else delete reactions[reaction];
        row['reactions'] = reactions;
        return ok(row);
      },
    },
    {
      method: 'POST',
      pattern: '/api/v1/work/issues/:key/links',
      handle: keyed((issue, request, db) => {
        const body = bodyOf<{ targetId: string; kind: string; inverse: boolean }>(request);
        const other = state(db).issues.find((row) => row.id === body.targetId);
        if (!other || other.id === issue.id) return invalid('targetId', 'Choose another issue.');
        const row = {
          id: newId(),
          sourceId: body.inverse ? other.id : issue.id,
          targetId: body.inverse ? issue.id : other.id,
          kind: body.kind ?? 'relates',
          createdBy: db.signedInAs,
          createdAt: now(),
        };
        state(db).links.push(row);
        return ok(row, 201);
      }),
    },
    {
      method: 'DELETE',
      pattern: '/api/v1/work/links/:id',
      handle: (request, db) => {
        const s = state(db);
        s.links = s.links.filter((row) => row.id !== request.params['id']);
        return ok();
      },
    },
    {
      method: 'GET',
      pattern: '/api/v1/work/search/suggest',
      handle: (request, db) => {
        const q = (request.query.get('q') ?? '').trim().toLowerCase();
        const items = state(db)
          .issues.filter((row) => !row['deletedAt'])
          .filter(
            (row) =>
              String(row['key']).toLowerCase().startsWith(q) ||
              String(row['title']).toLowerCase().includes(q),
          )
          .slice(0, 8)
          .map(({ id, key, projectId, title, statusId, typeId }) => ({
            id,
            key,
            projectId,
            title,
            statusId,
            typeId,
          }));
        return ok({ items });
      },
    },
  ];
}
