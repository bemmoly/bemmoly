import { DocEditor, RichTextView, type RichTextDoc } from '@bemmoly/editor';
import { Skeleton } from '@bemmoly/ui';
import { useEffect } from 'react';
import type { CollabPage } from '../../collab/use-collab-page.ts';
import { cx } from '../cx.ts';
import { usePageScreen, type PageEditor } from '../screen-context.ts';
import { TITLE_FIELD_ID } from './page-title.tsx';
import { useDocServices } from './use-doc-services.ts';

/** Headings stop below the top edge when the outline scrolls to them. */
const BODY = 'min-h-60 [&_h1]:scroll-mt-6 [&_h2]:scroll-mt-6 [&_h3]:scroll-mt-6';

/** True once the document has its content: synced once, or local with the stored copy. */
export function bodyReady(collab: Pick<CollabPage, 'status' | 'editable'>): boolean {
  return (
    collab.editable ||
    collab.status === 'live' ||
    collab.status === 'read-only' ||
    collab.status === 'local'
  );
}

/** ↑ on the first line of the body goes back up into the title, as ↓ in the title comes down. */
function useArrowUpToTitle(editor: PageEditor | null) {
  useEffect(() => {
    if (!editor) return undefined;
    const dom = editor.view.dom;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp' || event.shiftKey || event.metaKey || event.altKey) return;
      const { selection } = editor.state;
      if (!selection.empty || selection.from > 1) return;
      const title = document.getElementById(TITLE_FIELD_ID);
      if (!(title instanceof HTMLTextAreaElement)) return;
      event.preventDefault();
      title.focus();
      title.setSelectionRange(title.value.length, title.value.length);
    };
    dom.addEventListener('keydown', onKeyDown);
    return () => dom.removeEventListener('keydown', onKeyDown);
  }, [editor]);
}

/** Paragraph-shaped bars for a page whose body has not arrived and has no stored copy. */
function BodySkeleton() {
  return (
    <div role="status" aria-label="Loading the page body" className="flex flex-col gap-4.5">
      {[100, 96, 62].map((width) => (
        <span key={width} className="flex h-[1lh] items-center text-15h leading-prose">
          <Skeleton width={`${width}%`} height={11} />
        </span>
      ))}
    </div>
  );
}

/**
 * The body. Until the live document has synced, the stored copy prints read-only through the
 * same stylesheet, so the page reads at once and nothing moves when the editor takes over;
 * the editor mounts underneath, hidden, and swaps in on the first sync. A trashed page has no
 * live document and prints the stored copy only.
 */
export function PageBodyEditor({ onEditor }: { onEditor: (editor: PageEditor | null) => void }) {
  const { page, collab, editable, editor } = usePageScreen();
  const services = useDocServices(page.id);
  const ready = bodyReady(collab);
  useArrowUpToTitle(editor);
  const stored = page.snapshot as RichTextDoc | null;
  const live = Boolean(collab.extensions) && !page.deletedAt;

  return (
    <section aria-label="Page body" className="flex min-w-0 flex-col">
      {(!ready || !live) &&
        (stored?.content?.length ? (
          <RichTextView doc={stored} size="doc" services={services} className={BODY} />
        ) : (
          !page.deletedAt && <BodySkeleton />
        ))}
      {live && collab.extensions && (
        <div className={cx(!ready && 'hidden')} data-collab-status={collab.status}>
          <DocEditor
            key={collab.editorKey}
            label="Page body"
            extensions={collab.extensions}
            editable={editable}
            services={services}
            onEditor={onEditor}
            contentClassName={BODY}
          />
        </div>
      )}
    </section>
  );
}
