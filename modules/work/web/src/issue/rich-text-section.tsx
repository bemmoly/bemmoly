import { isEmptyDoc, preloadEditor, RichTextEditor, type RichTextDoc } from '@bemmoly/editor';
import type { RichText } from '@bemmoly/module-work/shared';
import { Button, IssueSection, SectionHeading, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { useEditorSources } from '../hooks/editor-sources.ts';
import { cx } from './cx.ts';
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

/** Not editing, or editing with this document so far (null while it is empty). */
type Draft = { doc: RichTextDoc | null } | null;

/**
 * Description, acceptance criteria and the other rich text fields: the document as the mock
 * prints it, and an Edit that opens the editor in the composer's box with the block tools.
 * The server derives the plain-text shadow from what is saved.
 */
export function RichTextSection({
  title,
  doc,
  onSave,
  size,
  placeholder = 'Nothing written yet.',
  readOnly = false,
}: RichTextSectionProps) {
  const [draft, setDraft] = useState<Draft>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const sources = useEditorSources();
  const empty = isEmptyDoc(doc as RichTextDoc | null | undefined);
  const name = title.toLowerCase();

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await onSave(isEmptyDoc(draft.doc) ? null : (draft.doc as RichText));
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

  const edit = () => setDraft({ doc: (doc as RichTextDoc | null | undefined) ?? null });
  const heading = (
    <SectionHeading
      title={title}
      size={size}
      actions={
        !readOnly && !draft ? (
          <button
            type="button"
            onClick={edit}
            onPointerEnter={preloadEditor}
            onFocus={preloadEditor}
            className="cursor-pointer border-0 bg-transparent p-0 font-sans text-12 font-normal text-tx4 hover:text-tx2"
          >
            Edit<span className="sr-only"> {name}</span>
          </button>
        ) : undefined
      }
    />
  );

  return (
    <IssueSection heading={heading}>
      {draft ? (
        <RichTextEditor
          label={title}
          placeholder={`Add ${name}…`}
          initialDoc={doc as RichTextDoc | null | undefined}
          blocks
          autoFocus
          size={size}
          sources={sources}
          contentClassName={size === 'page' ? 'min-h-24' : 'min-h-20'}
          onChange={(next) => setDraft({ doc: next })}
          onSubmit={() => void save()}
          onCancel={() => setDraft(null)}
        >
          {({ content, toolbar, ready }) => (
            <div className="flex flex-col gap-2.5 rounded-panel border border-br3 bg-sf px-3 py-2.5">
              {content}
              <div className="flex flex-wrap items-center gap-2.5 text-12 text-tx4">
                <div className="min-w-0 flex-1">{toolbar}</div>
                <span className="ml-auto flex gap-1.5">
                  <Button size="xs" variant="ghost" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    variant="primary"
                    loading={saving}
                    disabled={!ready}
                    onClick={() => void save()}
                  >
                    Save
                  </Button>
                </span>
              </div>
            </div>
          )}
        </RichTextEditor>
      ) : empty ? (
        <button
          type="button"
          disabled={readOnly}
          onClick={edit}
          onPointerEnter={readOnly ? undefined : preloadEditor}
          className={cx(
            'cursor-pointer rounded-sm border-0 bg-transparent p-0 text-left font-sans text-tx5',
            size === 'page' ? 'text-14' : 'text-13',
            readOnly && 'cursor-default',
          )}
        >
          {readOnly ? placeholder : `Add ${name}…`}
        </button>
      ) : (
        <RichTextView doc={doc} size={size} />
      )}
    </IssueSection>
  );
}
