import type { EntityRenderer } from '@bemmoly/core-web';
import { IssueCard, IssueChip } from './entities/issue-chip.tsx';
import { IssueTable } from './entities/issue-table.tsx';
import { api } from './shared/api.ts';

/**
 * What Work lends other modules for the records it owns, discovered by the
 * shell by this file's name: issues drawn as a chip, a linked row and a live
 * query table, and the issue search behind a document's `#` picker.
 */
const renderers: readonly EntityRenderer[] = [
  {
    kind: 'issue',
    Chip: IssueChip,
    Card: IssueCard,
    Table: IssueTable,
    search: async (query, signal) =>
      (await api.work.issues.suggest(query, signal)).map((issue) => ({
        id: issue.key,
        label: issue.key,
        description: issue.title,
      })),
  },
];

export default renderers;
