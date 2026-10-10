import type { AiRelatedSource, SqlExecutor } from '@bemmoly/core';
import { issuePath } from '../issues/notify.ts';
import { readIssueFacts } from './issue-rows.ts';

/**
 * What Work knows about an issue another module's context names: its fields as values and
 * its description, cited to the issue. Docs' consistency check compares a paragraph with it.
 */
export function createIssueDetailsSource(sql: () => SqlExecutor | undefined): AiRelatedSource {
  return {
    type: 'related',
    targetKinds: ['issue'],
    async collect(writer, target) {
      const db = sql();
      if (!db) return;
      const issue = await readIssueFacts(db, target.id);
      if (!issue) return;
      const fields = [
        `type ${issue.type}`,
        `status ${issue.status}`,
        `priority ${issue.priority}`,
        `assignee ${issue.assignee ?? 'unassigned'}`,
        issue.estimate ? `estimate ${Number(issue.estimate)} pts` : null,
        issue.dueAt ? `due ${issue.dueAt}` : null,
        issue.sprint ? `sprint ${issue.sprint}` : null,
        issue.fixVersion ? `fix version ${issue.fixVersion}` : null,
        issue.labels.length > 0 ? `labels ${issue.labels.join(', ')}` : null,
      ];
      writer.cite({
        kind: 'issue',
        objectId: issue.id,
        label: issue.key,
        location: 'fields and description',
        href: issuePath(issue.key),
        line: `${issue.key} · ${issue.title} · ${fields.filter(Boolean).join(' · ')}`,
        body: issue.description,
        scope: { projectId: issue.projectId, authorId: issue.reporterId },
        counts: 'issues',
      });
    },
  };
}
