import { formatRelative } from '@bemmoly/core-web';
import {
  KeyChip,
  PriorityGlyph,
  Skeleton,
  StatusBadge,
  TypeGlyph,
  type StatusCategory,
} from '@bemmoly/ui';
import type { MyIssue } from '../../../shared/index.ts';

/** Work's three status categories, drawn with the chip colours the mocks give them. */
const CATEGORY: Record<MyIssue['status']['category'], StatusCategory> = {
  todo: 'todo',
  in_progress: 'progress',
  done: 'done',
};

/** "Due Oct 7" when the issue has a due date, else when it last changed. */
function when(issue: MyIssue): string {
  if (issue.dueAt) {
    const due = new Date(`${issue.dueAt}T00:00:00`);
    return `Due ${due.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
  }
  return `Updated ${formatRelative(issue.updatedAt)}`;
}

export const issueHref = (key: string) => `/work/issue/${key}`;

const ROW =
  'grid grid-cols-[20px_84px_minmax(0,1fr)_120px_90px_28px] items-center gap-2.5 border-b border-br-row px-4 py-2.25 last:border-b-0';

/** One row of the Home mock's list: type, key, title, status, when, priority. */
export function MyWorkRow({ issue }: { issue: MyIssue }) {
  return (
    <a
      href={issueHref(issue.key)}
      className={`${ROW} text-tx no-underline hover:bg-sf2 focus-ring-inset motion-safe:transition-colors`}
    >
      <TypeGlyph type={issue.type} />
      <KeyChip issueKey={issue.key} />
      <span className="truncate" title={issue.title}>
        {issue.title}
      </span>
      <StatusBadge
        category={CATEGORY[issue.status.category]}
        label={issue.status.name}
        className="justify-self-start"
      />
      <span className="truncate text-12 text-tx4 tabular-nums" title={when(issue)}>
        {when(issue)}
      </span>
      <span className="text-center">
        <PriorityGlyph priority={issue.priority} />
      </span>
    </a>
  );
}

const TITLES = ['62%', '48%', '70%', '54%'];

/** A row while the lists load, as tall as a loaded one. */
export function MyWorkRowSkeleton({ index }: { index: number }) {
  return (
    <div aria-hidden className={`${ROW} text-13`}>
      <Skeleton width={14} height={14} className="rounded-chip" />
      <Skeleton width={56} height={9} />
      <span className="flex h-5.5 items-center">
        <Skeleton width={TITLES[index % TITLES.length]} height={10} />
      </span>
      <Skeleton width={72} height={18} className="rounded-xs" />
      <Skeleton width={64} height={9} />
      <Skeleton width={12} height={10} className="justify-self-center" />
    </div>
  );
}
