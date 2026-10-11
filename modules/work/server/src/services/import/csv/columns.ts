import type { ImportMapping } from '@bemmoly/shared';

/*
 * Which column feeds which issue field, matched by header in the words the common exports
 * use (Jira, Linear, GitHub, Trello and Asana CSVs among them). A column nothing matches is
 * reported, so the preview says what will be left behind.
 */

export const CSV_TARGETS = [
  'key',
  'title',
  'description',
  'status',
  'priority',
  'type',
  'assignee',
  'reporter',
  'labels',
  'due',
  'estimate',
  'created',
  'parent',
] as const;

export type CsvTarget = (typeof CSV_TARGETS)[number];

const SYNONYMS: Record<CsvTarget, readonly string[]> = {
  key: ['key', 'issue key', 'id', 'issue id', 'identifier', 'number', 'card id'],
  title: ['summary', 'title', 'name', 'task name', 'card name', 'issue'],
  description: ['description', 'body', 'notes', 'details', 'content'],
  status: ['status', 'state', 'list', 'section/column', 'column'],
  priority: ['priority'],
  type: ['issue type', 'issuetype', 'type', 'kind'],
  assignee: ['assignee', 'assignee email', 'assigned to', 'owner', 'members'],
  reporter: ['reporter', 'reporter email', 'creator', 'created by', 'author'],
  labels: ['labels', 'label', 'tags', 'tag'],
  due: ['due', 'due date', 'due on', 'duedate'],
  estimate: ['estimate', 'story points', 'points', 'story point estimate'],
  created: ['created', 'created at', 'created on', 'date created'],
  parent: ['parent', 'parent key', 'parent id', 'epic link', 'parent issue'],
};

const normal = (header: string) =>
  header
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim();

/** Header index for each target; the first matching column wins. */
export function mapColumns(headers: readonly string[]): Map<CsvTarget, number> {
  const map = new Map<CsvTarget, number>();
  headers.forEach((header, index) => {
    const name = normal(header);
    for (const target of CSV_TARGETS) {
      if (!map.has(target) && SYNONYMS[target].includes(name)) {
        map.set(target, index);
        return;
      }
    }
  });
  return map;
}

export function columnMappings(headers: readonly string[]): ImportMapping[] {
  const map = mapColumns(headers);
  const used = new Map([...map.entries()].map(([target, index]) => [index, target]));
  return headers.map((header, index) => {
    const target = used.get(index);
    return target
      ? {
          kind: 'column',
          source: header || `Column ${index + 1}`,
          action: 'match' as const,
          target,
          note: null,
        }
      : {
          kind: 'column',
          source: header || `Column ${index + 1}`,
          action: 'report' as const,
          target: null,
          note: 'No issue field matches; not imported',
        };
  });
}
