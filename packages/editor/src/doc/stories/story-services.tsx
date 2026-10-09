import { KeyChip, StatusBadge, type StatusCategory } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import type { DocServices } from '../services.ts';
import cutover from './cutover.svg?no-inline';

/*
 * What a host lends the Docs editor in the stories: issue chips drawn the way Work draws
 * them (the mock's inline chip with a type square and a status), page and people search,
 * an upload that answers with a local image, and an AI handler.
 */

const ISSUES: Record<
  string,
  { status: StatusCategory; label: string; square: string; title: string }
> = {
  'PLT-204': {
    status: 'review',
    label: 'In review',
    square: 'bg-ok',
    title: 'Session store migration to Postgres',
  },
  'PLT-218': {
    status: 'progress',
    label: 'In progress',
    square: 'bg-ok',
    title: 'Rotate service tokens on every deploy',
  },
  'PLT-222': {
    status: 'todo',
    label: 'To do',
    square: 'bg-ac',
    title: 'Rate-limit token refresh endpoint',
  },
};

function LiveIssue({ issueKey }: { issueKey: string }): ReactNode {
  const issue = ISSUES[issueKey];
  if (!issue) return <KeyChip inline issueKey={issueKey} typeClassName="bg-br3" />;
  return (
    <KeyChip inline issueKey={issueKey} href="#" typeClassName={issue.square} title={issue.title}>
      <StatusBadge size="xs" category={issue.status} label={issue.label} className="font-sans" />
    </KeyChip>
  );
}

function LiveIssueTable({ title }: { title: string }) {
  return (
    <div className="flex flex-col rounded-card border border-br text-13">
      <div className="border-b border-br-row px-3 py-2 text-12h font-semibold text-tx3">
        {title || 'Issues'}
      </div>
      {Object.entries(ISSUES).map(([key, issue]) => (
        <div
          key={key}
          className="flex items-center gap-3 border-b border-br-row px-3 py-2 last:border-b-0"
        >
          <span className="w-16 font-mono text-11h text-tx4">{key}</span>
          <span className="min-w-0 flex-1 truncate">{issue.title}</span>
          <StatusBadge size="sm" category={issue.status} label={issue.label} />
        </div>
      ))}
    </div>
  );
}

const pages = [
  { id: 'postmortem', label: 'Postmortem: Sep 29 login outage' },
  { id: 'runbook', label: 'Session migration runbook' },
  { id: 'services', label: 'Services map' },
];

const people = [
  { id: 'aisha', label: 'Aisha K.', description: 'aisha@example.org' },
  { id: 'jonas', label: 'Jonas M.', description: 'jonas@example.org' },
];

const match = <T extends { label: string }>(rows: T[], query: string) =>
  Promise.resolve(rows.filter((row) => row.label.toLowerCase().includes(query.toLowerCase())));

/** Work on: every service lent. */
export const WORK_ON: DocServices = {
  renderIssue: (key) => <LiveIssue issueKey={key} />,
  renderIssueTable: (attrs) => <LiveIssueTable title={attrs.title} />,
  searchPages: (query) => match(pages, query),
  pageHref: (id) => `#page-${id}`,
  searchIssues: (query) =>
    match(
      Object.entries(ISSUES).map(([id, issue]) => ({ id, label: id, description: issue.title })),
      query,
    ),
  searchPeople: (query) => match(people, query),
  uploadImage: async (file) => ({ src: cutover, alt: file.name }),
  ai: { run: () => undefined },
};

/** Work off and no AI: the editor's own fallbacks. */
export const WORK_OFF: DocServices = {
  searchPages: WORK_ON.searchPages!,
  pageHref: WORK_ON.pageHref!,
};
