import { formatRelative } from '@bemmoly/core-web';
import {
  ISSUE_TYPES,
  KeyChip,
  PriorityGlyph,
  StatusBadge,
  TypeGlyph,
  type IssueType,
  type StatusCategory,
} from '@bemmoly/ui';
import type { MyIssue } from '../../../shared/index.ts';

/** Work's three status categories, drawn with the chip colours the mocks give them. */
const CATEGORY: Record<MyIssue['status']['category'], StatusCategory> = {
  todo: 'todo',
  in_progress: 'progress',
  done: 'done',
};

const glyphType = (key: string): IssueType => (key in ISSUE_TYPES ? (key as IssueType) : 'task');

/** "Due Oct 7" when the issue has a due date, else when it last changed. */
function when(issue: MyIssue): string {
  if (issue.dueAt) {
    const due = new Date(`${issue.dueAt}T00:00:00`);
    return `Due ${due.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
  }
  return `Updated ${formatRelative(issue.updatedAt)}`;
}

export const issueHref = (key: string) => `/work/issue/${key}`;

/** One row of the Home mock's list: type, key, title, status, when, priority. */
export function MyWorkRow({ issue }: { issue: MyIssue }) {
  return (
    <a
      href={issueHref(issue.key)}
      className="grid grid-cols-[20px_84px_minmax(0,1fr)_120px_90px_28px] items-center gap-2.5 border-b border-br-row px-4 py-2.25 text-tx no-underline last:border-b-0 hover:bg-sf2"
    >
      <TypeGlyph type={glyphType(issue.type.key)} />
      <KeyChip issueKey={issue.key} />
      <span className="truncate">{issue.title}</span>
      <StatusBadge
        category={CATEGORY[issue.status.category]}
        label={issue.status.name}
        className="justify-self-start"
      />
      <span className="truncate text-12 text-tx4">{when(issue)}</span>
      <span className="text-center">
        <PriorityGlyph priority={issue.priority} />
      </span>
    </a>
  );
}
