import type { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { useCallback, useRef, useSyncExternalStore, type MouseEvent } from 'react';
import { headingIds, type TocEntry } from '../../convert/outline.ts';
import { cx } from '../../cx.ts';
import type { RichTextDoc } from '../../types.ts';
import type { NodeViewProps, ViewSpec } from '../portals.ts';
import { TOC_BOX, TOC_INDENT, TOC_LINK } from '../styles.ts';

/** The page's top-level headings, read from the live document with their positions. */
function headingsOf(doc: PmNode): { doc: RichTextDoc; positions: number[] } {
  const content: RichTextDoc['content'] = [];
  const positions: number[] = [];
  doc.forEach((child, offset) => {
    if (child.type.name !== 'heading') return;
    positions.push(offset);
    content.push({
      type: 'heading',
      attrs: { level: child.attrs['level'] },
      content: [{ type: 'text', text: child.textContent }],
    });
  });
  return { doc: { type: 'doc', content }, positions };
}

/** Re-reads the outline whenever the document changes, and only then. */
function useOutline(editor: Editor) {
  const cache = useRef<{ doc: PmNode; value: ReturnType<typeof headingsOf> } | null>(null);
  const subscribe = useCallback(
    (notify: () => void) => {
      editor.on('update', notify);
      return () => void editor.off('update', notify);
    },
    [editor],
  );
  return useSyncExternalStore(subscribe, () => {
    const doc = editor.state.doc;
    if (cache.current?.doc !== doc) cache.current = { doc, value: headingsOf(doc) };
    return cache.current.value;
  });
}

/** The list a table of contents prints, in the editor and the view alike. */
export function TocList({
  entries,
  onPick,
}: {
  entries: readonly TocEntry[];
  onPick?: (index: number, event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  if (entries.length === 0) {
    return <p className="m-0 text-tx-3">Headings you add appear here.</p>;
  }
  const top = Math.min(...entries.map((entry) => entry.level));
  return (
    <div role="list" className="flex flex-col gap-0.5">
      {entries.map((entry, index) => (
        <div
          role="listitem"
          key={`${entry.id}-${index}`}
          className={cx('min-w-0', TOC_INDENT[entry.level - top + 1])}
        >
          <a
            href={`#${entry.id}`}
            className={TOC_LINK}
            onClick={onPick ? (event) => onPick(index, event) : undefined}
          >
            {entry.text}
          </a>
        </div>
      ))}
    </div>
  );
}

function TocChrome({ node, editor }: NodeViewProps) {
  const { doc, positions } = useOutline(editor);
  const maxLevel = Number(node.attrs['maxLevel'] ?? 3);
  const ids = headingIds(doc);
  const shown = (doc.content ?? [])
    .map((heading, index) => ({
      level: Number(heading.attrs?.['level'] ?? 1),
      text: (heading.content?.[0]?.text ?? '').trim(),
      id: ids[index]!,
      at: positions[index]!,
    }))
    .filter((entry) => entry.text && entry.level <= maxLevel);
  return (
    <TocList
      entries={shown}
      onPick={(index, event) => {
        event.preventDefault();
        const at = shown[index]?.at;
        if (at === undefined) return;
        const dom = editor.view.nodeDOM(at);
        if (dom instanceof HTMLElement) dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
        editor.commands.setTextSelection(at + 1);
      }}
    />
  );
}

export const tocView: ViewSpec = {
  tag: 'nav',
  className: () => TOC_BOX,
  attrs: () => ({ 'data-type': 'toc', 'aria-label': 'Contents' }),
  Component: TocChrome,
};
