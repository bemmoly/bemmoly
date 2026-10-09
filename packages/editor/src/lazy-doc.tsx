import { lazy, Suspense } from 'react';
import { cx } from './cx.ts';
import type { DocEditorProps } from './doc/doc-editor-props.ts';
import { docPlaceholder } from './doc/services.ts';
import { proseClass } from './prose.ts';
import { RichTextView } from './view.tsx';

/*
 * The Docs editor is its own chunk, fetched the first time a page opens for editing (or when
 * preloadDocEditor is called on a hover that predicts one). Until it arrives the page prints
 * read-only through the same pieces, so nothing moves when the editor takes over.
 */

const load = () => import('./doc/doc-editor.tsx');
const Editor = lazy(load);

/** Starts fetching the Docs editor chunk; safe to call any number of times. */
export function preloadDocEditor(): void {
  void load();
}

function Fallback(props: DocEditorProps) {
  const empty = !props.initialDoc?.content?.length;
  return (
    <div aria-busy="true" className={cx('min-w-0', props.contentClassName)}>
      {empty ? (
        <div className={proseClass('doc', 'text-tx6')}>
          <p>{props.placeholder ?? docPlaceholder(Boolean(props.services?.ai))}</p>
        </div>
      ) : (
        <RichTextView doc={props.initialDoc} size="doc" services={props.services ?? {}} />
      )}
    </div>
  );
}

/** The Docs editor, loaded on first use. */
export function DocEditor(props: DocEditorProps) {
  return (
    <Suspense fallback={<Fallback {...props} />}>
      <Editor {...props} />
    </Suspense>
  );
}
