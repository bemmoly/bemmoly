import type { MockDb } from '../db.ts';
import { statuses } from './work-issue-detail.ts';
import { issueStore } from './work-issue-store.ts';
import { workState } from './work-state.ts';

/*
 * Work's answer to ⌘K on the in-memory backend, in the kernel's shape: issues by key prefix
 * or by a word of the title, under the "Issues" group, with "status · assignee" beside them
 * and the type and status ⌘K draws them with.
 */

export function workSearchHits(db: MockDb, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const names = statuses(db);
  const types = new Map(workState(db).issueTypes.map((type) => [type.id, type]));
  return issueStore(db)
    .issues.filter(
      (row) =>
        !row['deletedAt'] &&
        (String(row['key']).toLowerCase().startsWith(query) ||
          String(row['title']).toLowerCase().includes(query)),
    )
    .slice(0, 8)
    .map((row) => {
      const statusRow = names.get(String(row['statusId']));
      const status = statusRow?.['name'];
      const type = types.get(String(row['typeId']));
      const assignee = db.users.find((user) => user.id === row['assigneeId'])?.name;
      return {
        kind: 'work.issue',
        group: 'Issues',
        id: row.id,
        key: String(row['key']),
        title: String(row['title']),
        subtitle: [status, assignee].filter(Boolean).join(' · ') || null,
        href: `/work/issue/${String(row['key'])}`,
        look: {
          ...(type
            ? {
                type: {
                  key: String(type['key']),
                  icon: (type['icon'] as string | null) ?? null,
                  color: (type['color'] as string | null) ?? null,
                  level: (type['level'] as string | null) ?? null,
                },
              }
            : {}),
          ...(statusRow
            ? {
                status: {
                  category: statusRow['category'] as 'todo' | 'in_progress' | 'done',
                  name: String(status),
                },
              }
            : {}),
        },
      };
    });
}
