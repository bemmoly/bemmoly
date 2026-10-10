import { formatRelative } from '@bemmoly/core-web';
import { AiSummary } from '@bemmoly/ui';
import { Fragment, type ReactNode } from 'react';
import { usePeople } from '../../shared/people.ts';
import { usePageScreen } from '../screen-context.ts';
import { readingTime } from './doc-stats.ts';
import { PageTitle } from './page-title.tsx';

/** "Sep 12", with the year when it is not this one: "Sep 12, 2025". */
export function shortDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** One of the quiet chips over the title (RFC · Owner: Priya N. · Reviewers: Rohan, Jonas). */
function Chip({ children }: { children: ReactNode }) {
  return <li className="rounded-xs bg-chip px-2 py-0.75 leading-normal">{children}</li>;
}

/** The labels, owner and reviewers as the mock prints them above the title. */
function Chips() {
  const { page } = usePageScreen();
  const { person } = usePeople();
  const reviewers = page.reviewers.map((id) => person(id)?.name ?? 'Someone');
  if (page.labels.length === 0 && !page.owner && reviewers.length === 0) return null;
  return (
    <ul aria-label="Page facts" className="m-0 flex list-none flex-wrap gap-1.5 p-0 text-12 text-tx4">
      {page.labels.map((label) => (
        <Chip key={label}>{label}</Chip>
      ))}
      {page.owner && <Chip>Owner: {page.owner.name}</Chip>}
      {reviewers.length > 0 && <Chip>Reviewers: {reviewers.join(', ')}</Chip>}
    </ul>
  );
}

/** "Priya N. · Created Sep 12 · Edited 2h ago · 6 min read", over a hairline. */
function MetaLine() {
  const { page, stats } = usePageScreen();
  const parts = [
    [page.owner?.name, `Created ${shortDate(page.createdAt)}`, `Edited ${formatRelative(page.contentUpdatedAt)}`]
      .filter(Boolean)
      .join(' · '),
    readingTime(stats),
  ].filter(Boolean);
  return (
    <p className="m-0 flex flex-wrap items-center gap-3.5 border-b border-br-row pb-1.5 text-12h leading-normal text-tx5">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <span aria-hidden>·</span>}
          <span>{part}</span>
        </Fragment>
      ))}
    </p>
  );
}

/**
 * Everything above the body: the facts as chips, the title, the line about the page and,
 * when the page has one, its generated TL;DR on the AI surface (the one place the AI accent
 * appears). The stored summary is printed as it is; generating it arrives with AI.
 */
export function PageHeading() {
  const { page } = usePageScreen();
  return (
    <>
      <Chips />
      <PageTitle />
      <MetaLine />
      {page.tldr && (
        <AiSummary variant="page" title="TL;DR" source="generated · updates with the doc">
          {page.tldr}
        </AiSummary>
      )}
    </>
  );
}
