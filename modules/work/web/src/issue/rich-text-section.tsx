import { isEmptyDoc, preloadEditor, RichTextEditor, type RichTextDoc } from '@bemmoly/editor';
import type { RichText } from '@bemmoly/module-work/shared';
import { IconButton, Kbd, rowReveal, SaveState, SectionHeading } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useRef, useState, type FocusEvent, type MouseEvent } from 'react';
import { useEditorSources } from '../hooks/editor-sources.ts';
import { cx } from './cx.ts';
import { RichTextView } from './rich-text.tsx';
import { useAutosave } from './use-autosave.ts';

export interface RichTextSectionProps {
  title: string;
  doc: RichText | null | undefined;
  /** Saves the edited document; null clears it. */
  onSave: (doc: RichText | null) => Promise<unknown>;
  size: 'page' | 'panel';
  /** The empty surface's prompt. */
  placeholder?: string;
  /** The description prints no heading of its own: it is the issue's body text. */
  showTitle?: boolean;
  readOnly?: boolean;
}

const SURFACE = '-mx-2 rounded-card px-2 py-1.5';

/**
 * The description and the other rich text fields as an editor surface: the text at rest, and a
 * click on it (or Edit) puts the caret there in the shared editor, with / for blocks. What is
 * typed saves itself a moment after typing stops and when focus leaves; Escape or ⌘↵ finish.
 */
export function RichTextSection({
  title,
  doc,
  onSave,
  size,
  placeholder = 'Describe the problem, the context and what done looks like…',
  showTitle = true,
  readOnly = false,
}: RichTextSectionProps) {
  const [editing, setEditing] = useState(false);
  const sources = useEditorSources();
  const box = useRef<HTMLDivElement>(null);
  const autosave = useAutosave((next: RichTextDoc | null) =>
    onSave(isEmptyDoc(next) ? null : (next as RichText)),
  );
  const empty = isEmptyDoc(doc as RichTextDoc | null | undefined);
  const name = title.toLowerCase();

  const finish = () => {
    void autosave.flush();
    setEditing(false);
  };
  const start = () => {
    if (!readOnly) setEditing(true);
  };
  const onSurfaceClick = (event: MouseEvent<HTMLDivElement>) => {
    // Links in the text still open; only a click on the text itself starts editing.
    if ((event.target as HTMLElement).closest('a, button, input')) return;
    if (window.getSelection()?.toString()) return;
    start();
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    // Menus of the editor (slash, mentions) live in a portal; focus moving there stays inside.
    if (
      next &&
      (box.current?.contains(next) || (next as HTMLElement).closest?.('[role=listbox]'))
    ) {
      return;
    }
    finish();
  };

  const tools = (
    <span className="flex items-center gap-1">
      <SaveState state={autosave.state} onRetry={() => void autosave.retry()} />
      {!readOnly && !editing && !empty && (
        <IconButton
          label={`Edit ${name}`}
          icon={<Icon name="edit" size={14} />}
          size="xs"
          onClick={start}
          onPointerEnter={preloadEditor}
          // Without a heading the pencil floats on the text's corner, shown on hover and focus.
          className={showTitle ? undefined : rowReveal}
        />
      )}
    </span>
  );
  const saving = autosave.state !== 'idle';

  return (
    <section aria-label={title} className="group/row relative flex flex-col gap-1">
      {showTitle ? (
        <div className="flex min-h-6 items-center gap-2">
          <SectionHeading title={title} size={size} />
          <span className="ml-auto">{tools}</span>
        </div>
      ) : (
        // The description is the issue's body: no heading row, so no gap above its first line.
        !editing &&
        (saving || (!empty && !readOnly)) && (
          <div className="absolute -top-1 right-0 z-10">{tools}</div>
        )
      )}
      {editing ? (
        <div ref={box} onBlur={onBlur} className={cx(SURFACE, 'bg-card shadow-e1')}>
          <RichTextEditor
            label={title}
            placeholder={placeholder}
            initialDoc={doc as RichTextDoc | null | undefined}
            blocks
            autoFocus
            size={size}
            sources={sources}
            contentClassName={size === 'page' ? 'min-h-24' : 'min-h-20'}
            onChange={autosave.change}
            onSubmit={finish}
            onCancel={finish}
          >
            {({ content, toolbar }) => (
              <div className="flex flex-col gap-2">
                {content}
                <div className="flex flex-wrap items-center gap-2.5 border-t border-line-2 pt-1.5 text-12 text-tx-3">
                  <div className="min-w-0 flex-1">{toolbar}</div>
                  {!showTitle && (
                    <SaveState state={autosave.state} onRetry={() => void autosave.retry()} />
                  )}
                  <span className="hidden items-center gap-1 sm:flex">
                    <Kbd keys="Esc" /> to finish
                  </span>
                </div>
              </div>
            )}
          </RichTextEditor>
        </div>
      ) : empty ? (
        <button
          type="button"
          disabled={readOnly}
          onClick={start}
          onPointerEnter={readOnly ? undefined : preloadEditor}
          onFocus={readOnly ? undefined : preloadEditor}
          className={cx(
            SURFACE,
            'flex cursor-text flex-col gap-2.5 border-0 bg-transparent text-left font-sans text-tx-3 hover:bg-hover focus-ring',
            size === 'page' ? 'text-14 leading-desc' : 'text-13',
            readOnly && 'cursor-default hover:bg-transparent',
          )}
        >
          <span>{readOnly ? 'Nothing written yet.' : placeholder}</span>
          {!readOnly && (
            <span className="flex items-center gap-1.5 text-12">
              <Kbd keys="/" />
              for headings, checklists, code and issue links
            </span>
          )}
        </button>
      ) : (
        <div
          onClick={onSurfaceClick}
          onPointerEnter={readOnly ? undefined : preloadEditor}
          className={cx(
            SURFACE,
            !readOnly && 'cursor-text hover:bg-hover',
            !showTitle && !readOnly && 'pr-10',
          )}
        >
          <RichTextView doc={doc} size={size} />
        </div>
      )}
    </section>
  );
}
