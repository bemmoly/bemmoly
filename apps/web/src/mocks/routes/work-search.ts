import type { MockDb } from '../db.ts';
import { statuses } from './work-issue-detail.ts';
import { issueStore } from './work-issue-store.ts';

/*
 * Work's answer to ⌘K on the in-memory backend, in the kernel's shape: issues by key prefix
 * or by a word of the title, under the "Issues" group, with "status · assignee" beside them.
 */

export function workSearchHits(db: MockDb, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return [];
  const names = statuses(db);
  return issueStore(db)
    .issues.filter(
      (row) =>
        !row['deletedAt'] &&
        (String(row['key']).toLowerCase().startsWith(query) ||
          String(row['title']).toLowerCase().includes(query)),
    )
    .slice(0, 8)
    .map((row) => {
      const status = names.get(String(row['statusId']))?.['name'];
      const assignee = db.users.find((user) => user.id === row['assigneeId'])?.name;
      return {
        kind: 'work.issue',
        group: 'Issues',
        id: row.id,
        key: String(row['key']),
        title: String(row['title']),
        subtitle: [status, assignee].filter(Boolean).join(' · ') || null,
        href: `/work/issue/${String(row['key'])}`,
      };
    });
}
