import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../cx.ts';
import { usePageScreen } from '../screen-context.ts';
import { useUpdatePage } from '../use-page-actions.ts';

/** The review's title (docs-kit .d-title): 36px/1.15, outside the app's type steps on purpose. */
const TITLE = 'm-0 text-[36px] leading-display font-semibold tracking-display text-tx';

export const TITLE_FIELD_ID = 'page-title';

/**
 * The page's title, edited where it stands: the field is drawn exactly as the heading, so
 * nothing moves when the caret lands in it. Enter (or ↓ at the end) carries the caret into the
 * body; Escape puts the saved title back. It saves on leaving the field, and a rename made
 * elsewhere shows unless the person is typing over it.
 */
export function PageTitle() {
  const { page, editable, focusBody } = usePageScreen();
  const update = useUpdatePage(page.id);
  const [draft, setDraft] = useState(page.title);
  const [focused, setFocused] = useState(false);
  /** Escape leaves the field without saving what was typed. */
  const discard = useRef(false);

  useEffect(() => {
    if (!focused) setDraft(page.title);
  }, [page.title, focused]);

  const save = () => {
    const next = draft.replace(/\s+/g, ' ').trim();
    if (next !== draft) setDraft(next);
    if (next === page.title) return;
    update.mutate({ title: next });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    const atEnd = target.selectionStart === target.value.length;
    if (event.key === 'Enter' || (event.key === 'ArrowDown' && atEnd)) {
      event.preventDefault();
      save();
      focusBody();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      discard.current = true;
      setDraft(page.title);
      target.blur();
    }
  };

  if (!editable) {
    return (
      <h1 className={cx(TITLE, 'text-pretty break-words', !page.title && 'text-tx-3')}>
        {page.title || 'Untitled'}
      </h1>
    );
  }

  return (
    <h1 className={cx(TITLE, 'flex items-start')}>
      <textarea
        id={TITLE_FIELD_ID}
        aria-label="Page title"
        rows={1}
        maxLength={500}
        spellCheck
        placeholder="Untitled"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/\n/g, ' '))}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (discard.current) discard.current = false;
          else save();
        }}
        onKeyDown={onKeyDown}
        className={cx(
          TITLE,
          'block min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 font-sans [field-sizing:content]',
          'caret-acc outline-0 placeholder:text-tx-3',
        )}
      />
    </h1>
  );
}
