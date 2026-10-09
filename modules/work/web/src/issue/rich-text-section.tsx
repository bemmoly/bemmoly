import type { RichText } from '@bemmoly/module-work/shared';
import { Button, IssueSection, SectionHeading, Textarea, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { cx } from './cx.ts';
import { docToText, isEmptyDoc, textToDoc } from './rich-text-convert.ts';
import { RichTextView } from './rich-text.tsx';

export interface RichTextSectionProps {
  title: string;
  doc: RichText | null | undefined;
  /** Saves the edited document; null clears it. */
  onSave: (doc: RichText | null) => Promise<unknown>;
  size: 'page' | 'panel';
  /** Shown in place of an empty document. */
  placeholder?: string;
  readOnly?: boolean;
}

/**
 * Description, acceptance criteria and the other rich text fields: the document as the mock
 * prints it, and an Edit that swaps in a text box until the editor package lands here.
 */
export function RichTextSection({
  title,
  doc,
  onSave,
  size,
  placeholder = 'Nothing written yet.',
  readOnly = false,
}: RichTextSectionProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const empty = isEmptyDoc(doc);

  const save = async () => {
    if (draft === null) return;
    setSaving(true);
    try {
      await onSave(textToDoc(draft));
      setDraft(null);
    } catch (error) {
      toast.show({
        tone: 'danger',
        title: `${title} was not saved`,
        body: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setSaving(false);
    }
  };

  const edit = () => setDraft(docToText(doc));
  const heading = (
    <SectionHeading
      title={title}
      size={size}
      actions={
        !readOnly && draft === null ? (
          <button
            type="button"
            onClick={edit}
            className="cursor-pointer border-0 bg-transparent p-0 font-sans text-12 font-normal text-tx4 hover:text-tx2"
          >
            Edit<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        ) : undefined
      }
    />
  );

  return (
    <IssueSection heading={heading}>
      {draft !== null ? (
        <div className="flex flex-col gap-2">
          <Textarea
            aria-label={title}
            autoFocus
            rows={size === 'page' ? 8 : 6}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setDraft(null);
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void save();
            }}
          />
          <div className="flex items-center gap-2">
            <span className="mr-auto text-12 text-tx5">
              Blank line between paragraphs, “- ” for a bullet, “[ ] ” for a checklist item.
            </span>
            <Button size="xs" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button size="xs" variant="primary" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </div>
      ) : empty ? (
        <button
          type="button"
          disabled={readOnly}
          onClick={edit}
          className={cx(
            'cursor-pointer rounded-sm border-0 bg-transparent p-0 text-left font-sans text-tx5',
            size === 'page' ? 'text-14' : 'text-13',
            readOnly && 'cursor-default',
          )}
        >
          {readOnly ? placeholder : `Add ${title.toLowerCase()}…`}
        </button>
      ) : (
        <RichTextView doc={doc} size={size} />
      )}
    </IssueSection>
  );
}
