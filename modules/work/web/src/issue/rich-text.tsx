import { RichTextView as DocumentView, type ProseSize, type RichTextDoc } from '@bemmoly/editor';
import type { RichText } from '@bemmoly/module-work/shared';
import { useMarkdownDoc } from './use-markdown-doc.ts';

export interface RichTextViewProps {
  doc: RichText | null | undefined;
  /** page: the Issue page (14px at 1.65). panel: the drawer (13px at 1.6 in tx2). comment: 13px. */
  size?: ProseSize;
  className?: string;
}

/**
 * A description, a document field or a comment, read-only, exactly as the editor shows it.
 * In-app links move through the screen's own link handling. Markdown saved as plain lines
 * prints formatted.
 */
export function RichTextView({ doc, size = 'page', className }: RichTextViewProps) {
  const shown = useMarkdownDoc(doc);
  return (
    <DocumentView
      doc={shown as RichTextDoc | null | undefined}
      size={size}
      {...(className ? { className } : {})}
    />
  );
}
