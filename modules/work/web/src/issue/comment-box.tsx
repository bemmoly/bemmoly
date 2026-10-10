import { isEmptyDoc, preloadEditor, RichTextEditor, type RichTextDoc } from '@bemmoly/editor';
import type { RichText } from '@bemmoly/module-work/shared';
import { Button, CommentComposer, ComposerPlaceholder, useToast } from '@bemmoly/ui';
import { useEffect, useState } from 'react';
import { useEditorSources } from '../hooks/editor-sources.ts';
import type { Person } from '../hooks/issue-people.ts';

export interface CommentBoxProps {
  viewer: Person;
  onSubmit: (body: RichText) => Promise<unknown>;
  /** Starts open with the cursor in the box, as Reply and Edit do. */
  open?: boolean;
  /** The comment being edited. */
  initialBody?: RichText | null;
  /** Names the text box and its toolbar: "Comment", "Reply". */
  label?: string;
  placeholder?: string;
  submitLabel?: string;
  onCancel?: () => void;
  /** Opens the box when M is pressed outside a field, as the mock's key hint says. */
  shortcut?: boolean;
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * The comment composer: the collapsed "Add a comment… M" line, which opens into the editor
 * with the mock's tools (B, I, @, Link, Code) and Comment and Cancel at the end of the row.
 */
export function CommentBox({
  viewer,
  onSubmit,
  open: startOpen = false,
  initialBody = null,
  label = 'Comment',
  placeholder = 'Leave a comment…',
  submitLabel = 'Comment',
  onCancel,
  shortcut = false,
}: CommentBoxProps) {
  const [open, setOpen] = useState(startOpen);
  const [body, setBody] = useState<RichTextDoc | null>(initialBody as RichTextDoc | null);
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const sources = useEditorSources();

  useEffect(() => {
    if (!shortcut) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'm' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (typing(event.target) || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);

  const cancel = () => {
    setBody(initialBody as RichTextDoc | null);
    setOpen(false);
    onCancel?.();
  };

  const send = async () => {
    if (!body || isEmptyDoc(body) || sending) return;
    setSending(true);
    try {
      await onSubmit(body as RichText);
      setBody(null);
      setOpen(false);
      onCancel?.();
    } catch (error) {
      toast.show({
        tone: 'danger',
        title: 'The comment was not posted',
        body: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <CommentComposer viewer={{ name: viewer.name }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerEnter={preloadEditor}
          onFocus={preloadEditor}
          className="cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-13"
        >
          <ComposerPlaceholder hint={shortcut ? 'M' : undefined}>
            {placeholder}
            <span className="text-12">@ to mention, / for blocks</span>
          </ComposerPlaceholder>
        </button>
      </CommentComposer>
    );
  }

  return (
    <RichTextEditor
      label={label}
      placeholder={placeholder}
      initialDoc={initialBody as RichTextDoc | null}
      autoFocus
      size="comment"
      sources={sources}
      contentClassName="min-h-15 leading-brief"
      onChange={setBody}
      onSubmit={() => void send()}
      onCancel={cancel}
    >
      {({ content, toolbar, ready }) => (
        <CommentComposer
          viewer={{ name: viewer.name }}
          tools={toolbar}
          end={
            <span className="flex gap-1.5">
              <Button size="xs" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
              <Button
                size="xs"
                variant="primary"
                loading={sending}
                disabled={!ready || isEmptyDoc(body)}
                onClick={() => void send()}
              >
                {submitLabel}
              </Button>
            </span>
          }
        >
          {content}
        </CommentComposer>
      )}
    </RichTextEditor>
  );
}
