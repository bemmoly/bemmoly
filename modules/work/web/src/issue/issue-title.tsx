import type { IssueDetail } from '@bemmoly/module-work/shared';
import { DrawerTitle } from '@bemmoly/ui';
import { useLayoutEffect, useRef, useState } from 'react';
import { cx } from './cx.ts';
import { useIssueEdit } from './use-issue-edit.ts';

/** The page title reads like a document's: the largest size, tight tracking, no frame. */
const TYPE = {
  page: 'text-24 leading-title font-semibold tracking-title',
  panel: 'text-18 leading-title font-semibold tracking-brand',
} as const;

/**
 * The title, edited in place: a click puts the caret where the text was, with the same type
 * and wrapping, so nothing moves. Enter or leaving the field saves, Escape puts it back.
 */
export function IssueTitle({ issue, size }: { issue: IssueDetail; size: 'page' | 'panel' }) {
  const [draft, setDraft] = useState<string | null>(null);
  const { edit } = useIssueEdit(issue.key);
  const field = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const box = field.current;
    if (!box) return;
    box.style.height = '0px';
    box.style.height = `${box.scrollHeight}px`;
  }, [draft]);

  const commit = () => {
    const next = draft?.trim() ?? '';
    setDraft(null);
    if (!next || next === issue.title) return;
    edit({ body: { title: next }, what: 'The title' });
  };

  const shared = cx(
    '-mx-1.5 block w-[calc(100%+0.75rem)] rounded-panel px-1.5 py-0.5 text-left font-sans text-tx text-pretty',
    TYPE[size],
  );

  if (draft !== null) {
    return (
      <textarea
        ref={field}
        aria-label="Title"
        autoFocus
        rows={1}
        value={draft}
        onFocus={(event) => {
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        onChange={(event) => setDraft(event.target.value.replace(/\n/g, ' '))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
          if (event.key === 'Escape') {
            event.stopPropagation();
            setDraft(null);
          }
        }}
        className={cx(
          shared,
          'm-0 resize-none overflow-hidden border-0 bg-hover outline-2 outline-offset-0 outline-ac',
        )}
      />
    );
  }

  const title = (
    <button
      type="button"
      onClick={() => setDraft(issue.title)}
      aria-label={`${issue.title}. Edit the title`}
      className={cx(shared, 'cursor-text border-0 bg-transparent hover:bg-hover focus-ring')}
    >
      {issue.title}
    </button>
  );
  return size === 'page' ? <h1 className="m-0">{title}</h1> : <DrawerTitle>{title}</DrawerTitle>;
}
