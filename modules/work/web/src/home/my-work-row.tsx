import { PriorityGlyph, RelativeTime, Skeleton, TypeGlyph } from '@bemmoly/ui';
import type { MyIssue } from '../../../shared/index.ts';
import { linkTo } from '../hooks/issue-navigation.ts';

/** "Due Oct 7" when the issue has a due date; otherwise when it last changed. */
function When({ issue }: { issue: MyIssue }) {
  if (issue.dueAt) {
    const due = new Date(`${issue.dueAt}T00:00:00`);
    const text = `Due ${due.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
    return <span className="text-12 whitespace-nowrap text-tx-3 tabular-nums">{text}</span>;
  }
  return (
    <span className="text-12 whitespace-nowrap text-tx-3">
      <span className="hidden sm:inline">Updated </span>
      <RelativeTime iso={issue.updatedAt} />
    </span>
  );
}

export const issueHref = (key: string) => `/work/issue/${key}`;

/** The list row of the review (kit.css `.lrow`): 36px, type, key, title, then its facts. */
export const ROW =
  'grid h-9 grid-cols-[16px_64px_minmax(0,1fr)_auto_16px] items-center gap-2.5 border-b border-line-2 px-3.5 last:border-b-0';

/** One of my issues: type, key, title, when, priority; the whole row opens the issue. */
export function MyWorkRow({ issue }: { issue: MyIssue }) {
  return (
    <a
      {...linkTo(issueHref(issue.key))}
      className={`${ROW} text-13 text-tx no-underline hover:bg-hover focus-ring-inset`}
    >
      <TypeGlyph type={issue.type} />
      <span className="font-mono text-11 text-tx-3">{issue.key}</span>
      <span className="truncate" title={issue.title}>
        {issue.title}
      </span>
      <When issue={issue} />
      <PriorityGlyph priority={issue.priority} />
    </a>
  );
}

const TITLES = ['62%', '48%', '70%', '54%'];

/** A row while the lists load, as tall as a loaded one. */
export function MyWorkRowSkeleton({ index }: { index: number }) {
  return (
    <div aria-hidden className={ROW}>
      <Skeleton width={14} height={14} className="rounded-chip" />
      <Skeleton width={52} height={9} />
      <Skeleton width={TITLES[index % TITLES.length]} height={10} />
      <Skeleton width={56} height={9} />
      <Skeleton width={12} height={10} />
    </div>
  );
}
