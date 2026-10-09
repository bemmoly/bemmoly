import type { RichText } from '@bemmoly/module-work/shared';
import { Button, CommentComposer, ComposerPlaceholder, useToast } from '@bemmoly/ui';
import { useEffect, useRef, useState } from 'react';
import type { Person } from '../hooks/issue-people.ts';
import { textToDoc } from './rich-text-convert.ts';

export interface CommentBoxProps {
  viewer: Person;
  onSubmit: (body: RichText) => Promise<unknown>;
  /** Starts open with the cursor in the box, as Reply and Edit do. */
  open?: boolean;
  initialText?: string;
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
 * The comment composer: the collapsed "Add a comment… M" line, which opens into a text box
 * with Comment and Cancel. Text becomes paragraphs and lists, as descriptions do.
 */
export function CommentBox({
  viewer,
  onSubmit,
  open: startOpen = false,
  initialText = '',
  placeholder = 'Add a comment…',
  submitLabel = 'Comment',
  onCancel,
  shortcut = false,
}: CommentBoxProps) {
  const [open, setOpen] = useState(startOpen);
  const [text, setText] = useState(initialText);
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

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

  useEffect(() => {
    if (open) box.current?.focus();
  }, [open]);

  const cancel = () => {
    setText(initialText);
    setOpen(false);
    onCancel?.();
  };

  const send = async () => {
    const body = textToDoc(text);
    if (!body) return;
    setSending(true);
    try {
      await onSubmit(body);
      setText('');
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
          className="cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-13"
        >
          <ComposerPlaceholder hint={shortcut ? 'M' : undefined}>{placeholder}</ComposerPlaceholder>
        </button>
      </CommentComposer>
    );
  }

  return (
    <CommentComposer
      viewer={{ name: viewer.name }}
      tools={<span className="text-tx5">Blank line between paragraphs · ⌘↵ to send</span>}
      end={
        <span className="flex gap-1.5">
          <Button size="xs" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
          <Button
            size="xs"
            variant="primary"
            loading={sending}
            disabled={!text.trim()}
            onClick={() => void send()}
          >
            {submitLabel}
          </Button>
        </span>
      }
    >
      <textarea
        ref={box}
        aria-label={placeholder}
        rows={3}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancel();
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void send();
        }}
        className="w-full resize-y border-0 bg-transparent p-0 font-sans text-13 leading-brief text-tx outline-0 placeholder:text-tx5"
      />
    </CommentComposer>
  );
}
