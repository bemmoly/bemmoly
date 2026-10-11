import { plainMarkdown, type RichTextDoc } from '@bemmoly/editor';
import type { RichText } from '@bemmoly/module-work/shared';
import { useEffect, useMemo, useState } from 'react';

const parser = () => import('@bemmoly/editor/markdown');

/**
 * The document to show and edit: one saved as Markdown typed into plain lines (from the API or
 * an AI client) comes back parsed, with its headings, lists, code and tables. The parser loads
 * only for such a document; until it arrives the lines show as they are. Nothing is saved
 * until the person edits, and then the parsed document is what saves.
 */
export function useMarkdownDoc<T extends RichText | null | undefined>(doc: T): T {
  const source = useMemo(() => plainMarkdown(doc as RichTextDoc | null | undefined), [doc]);
  const [parsed, setParsed] = useState<{ source: string; doc: RichText } | null>(null);

  useEffect(() => {
    if (source === null || parsed?.source === source) return undefined;
    let live = true;
    void parser().then(({ fromMarkdownBase }) => {
      if (live) setParsed({ source, doc: fromMarkdownBase(source) as RichText });
    });
    return () => {
      live = false;
    };
  }, [source, parsed]);

  return source !== null && parsed?.source === source ? (parsed.doc as T) : doc;
}
