import type { IssueDetail } from '@bemmoly/module-work/shared';
import { AiSummary, DrawerTitle, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { useUpdateIssue } from '../hooks/issue-detail.ts';
import { cx } from './cx.ts';

const PAGE = 'm-0 text-24 leading-title font-semibold tracking-title text-pretty';

/** The title, 24px on the page and 18px in the slide-over; a click edits it in place. */
export function IssueTitle({ issue, size }: { issue: IssueDetail; size: 'page' | 'panel' }) {
  const [draft, setDraft] = useState<string | null>(null);
  const update = useUpdateIssue(issue.key);
  const toast = useToast();

  const commit = () => {
    const next = draft?.trim() ?? '';
    setDraft(null);
    if (!next || next === issue.title) return;
    update.mutate(
      { title: next },
      {
        onError: (error) =>
          toast.show({ tone: 'danger', title: 'The title was not saved', body: error.message }),
      },
    );
  };

  if (draft !== null) {
    return (
      <textarea
        aria-label="Title"
        autoFocus
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/\n/g, ' '))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') setDraft(null);
        }}
        className={cx(
          'w-full resize-none rounded-control border border-ac bg-sf px-2 py-1 font-sans text-tx shadow-ring outline-0',
          size === 'page' ? PAGE : 'text-18 leading-title font-semibold tracking-brand',
          '-mx-2 -my-1',
        )}
      />
    );
  }

  const edit = () => setDraft(issue.title);
  const title = (
    <button
      type="button"
      onClick={edit}
      title="Edit the title"
      className="-mx-1 cursor-text rounded-sm border-0 bg-transparent px-1 text-left text-tx hover:bg-bg2"
    >
      {issue.title}
    </button>
  );
  return size === 'page' ? <h1 className={PAGE}>{title}</h1> : <DrawerTitle>{title}</DrawerTitle>;
}

/** The AI summary card in its empty state: AI is not part of this release. */
export function SummaryPlaceholder({ size }: { size: 'page' | 'panel' }) {
  return (
    <AiSummary variant={size} source="not available yet">
      <span className="text-tx4">
        A summary of the comments, links and history will appear here once AI is turned on for this
        workspace.
      </span>
    </AiSummary>
  );
}
