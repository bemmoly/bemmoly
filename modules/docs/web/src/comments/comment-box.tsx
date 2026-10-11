import type { RichText } from '@bemmoly/module-docs/shared';
import { isEmptyDoc, RichTextEditor, type RichTextDoc } from '@bemmoly/editor';
import { Button, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { useMentionSources } from './mention-sources.ts';

export interface CommentBoxProps {
  /** Names the text box: "Comment", "Reply", "Edit comment". */
  label: string;
  placeholder?: string;
  submitLabel?: string;
  initialBody?: RichText | null;
  onSubmit: (body: RichText) => Promise<unknown>;
  onCancel: () => void;
  autoFocus?: boolean;
}

/**
 * The rail's comment box: the shared rich text editor at comment size, with @ for people,
 * in a br3 box the width of a thread card, Cancel and the submit action at the end of the
 * tool row. ⌘↵ sends, Escape cancels; the text stays put if the send fails.
 */
export function CommentBox({
  label,
  placeholder = 'Add a comment…',
  submitLabel = 'Comment',
  initialBody = null,
  onSubmit,
  onCancel,
  autoFocus = true,
}: CommentBoxProps) {
  const [body, setBody] = useState<RichTextDoc | null>(initialBody as RichTextDoc | null);
  const [sending, setSending] = useState(false);
  const sources = useMentionSources();
  const toast = useToast();

  const send = async () => {
    if (!body || isEmptyDoc(body) || sending) return;
    setSending(true);
    try {
      await onSubmit(body as RichText);
      setBody(null);
    } catch (error) {
      toast.show({
        tone: 'danger',
        title: 'The comment was not saved',
        body: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <RichTextEditor
      label={label}
      placeholder={placeholder}
      initialDoc={initialBody as RichTextDoc | null}
      autoFocus={autoFocus}
      size="comment"
      sources={sources}
      contentClassName="min-h-10 leading-body"
      onChange={setBody}
      onSubmit={() => void send()}
      onCancel={onCancel}
    >
      {({ content, toolbar, ready }) => (
        <div className="flex flex-col gap-2 rounded-control border border-line bg-card px-2.5 py-2 text-13 text-tx focus-within:border-acc-100">
          {content}
          <div className="flex flex-wrap items-center gap-2 text-12 text-tx-3">
            {toolbar}
            <span className="ml-auto flex gap-1.5">
              <Button size="xs" variant="ghost" onClick={onCancel}>
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
          </div>
        </div>
      )}
    </RichTextEditor>
  );
}
