import type { EntityRenderer } from '@bemmoly/core-web';
import { IssueCard, IssueChip } from './entities/issue-chip.tsx';
import { IssueEmbedCard } from './entities/issue-embed-card.tsx';
import { IssueTable } from './entities/issue-table.tsx';
import { issueHref } from './home/my-work-row.tsx';
import { rememberIssueList } from './issue/issue-list-context.ts';
import { api } from './shared/api.ts';

/**
 * What Work lends other modules for the records it owns, discovered by the
 * shell by this file's name: issues drawn as a chip, a linked row, a card block and a live
 * query table, the issue search behind a document's `#` picker, and the list an issue is
 * opened from (the Inbox's), for the issue page's j and k.
 */
const renderers: readonly EntityRenderer[] = [
  {
    kind: 'issue',
    Chip: IssueChip,
    Card: IssueCard,
    Embed: IssueEmbedCard,
    Table: IssueTable,
    rememberList: rememberIssueList,
    search: async (query, signal) =>
      (await api.work.issues.suggest(query, signal)).map((issue) => ({
        id: issue.key,
        label: issue.key,
        description: issue.title,
        href: issueHref(issue.key),
      })),
  },
];

export default renderers;
