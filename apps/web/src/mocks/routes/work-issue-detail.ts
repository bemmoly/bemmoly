import type { MockDb } from '../db.ts';
import type { IssuesState } from './work-issue-activity.ts';
import { workState, type Row } from './work-state.ts';

/* The Issue page's read of one issue, with the names it prints beside each field. */

const byId = (rows: Row[], id: unknown) => rows.find((row) => row.id === id);

export function statuses(db: MockDb) {
  return new Map(
    workState(db)
      .workflows.flatMap((flow) => flow['statuses'] as Row[])
      .map((status) => [status.id, status]),
  );
}

const ref = (row: Row | undefined) => (row ? { id: row.id, name: String(row['name']) } : null);
const issueRef = ({ id, key, title, statusId, typeId }: Row) => ({
  id,
  key,
  title,
  statusId,
  typeId,
});
function person(db: MockDb, id: unknown) {
  const user = db.users.find((entry) => entry.id === id);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

/** The detail response: the issue and every name the page prints beside a field. */
export function issueDetail(db: MockDb, s: IssuesState, issue: Row) {
  const type = byId(workState(db).issueTypes, issue['typeId']);
  const status = statuses(db).get(String(issue['statusId']));
  const sprint = byId(s.sprints, issue['sprintId']);
  const links = s.links
    .filter((link) => link['sourceId'] === issue.id || link['targetId'] === issue.id)
    .flatMap((link) => {
      const inverse = link['targetId'] === issue.id;
      const other = byId(s.issues, inverse ? link['sourceId'] : link['targetId']);
      return other ? [{ id: link.id, kind: link['kind'], inverse, issue: issueRef(other) }] : [];
    });
  const watchers = s.watchers[issue.id] ?? [];
  return {
    ...issue,
    type: { ...ref(type), key: type?.['key'], level: type?.['level'], icon: type?.['icon'] },
    status: { ...ref(status), category: status?.['category'], color: status?.['color'] ?? null },
    assignee: person(db, issue['assigneeId']),
    reporter: person(db, issue['reporterId']),
    parent: issue['parentId'] ? issueRef(byId(s.issues, issue['parentId']) as Row) : null,
    sprint: sprint ? { ...ref(sprint), state: sprint['state'] } : null,
    fixVersion: ref(byId(s.versions, issue['fixVersionId'])),
    labels: (issue['labelIds'] as string[]).flatMap((id) => {
      const label = byId(s.labels, id);
      return label ? [{ ...ref(label), color: label['color'] }] : [];
    }),
    links,
    subtasks: s.issues
      .filter((row) => row['parentId'] === issue.id && !row['deletedAt'])
      .map(issueRef),
    watchersCount: watchers.length,
    watching: watchers.includes(db.signedInAs ?? ''),
  };
}
