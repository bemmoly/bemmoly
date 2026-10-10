import { lazy, Suspense } from 'react';
import { cx } from './cx.ts';
import type { EditorParts, RichTextEditorProps } from './editor-props.ts';
import { proseClass } from './prose.ts';
import { RichTextView } from './view.tsx';

/*
 * The editor and ProseMirror are one chunk, fetched the first time an editor mounts (or when
 * preloadEditor is called on a hover or focus that predicts one). Until it arrives, the host's
 * layout renders with the document printed read-only and the tool glyphs drawn inert, so
 * nothing moves when the editor takes over.
 */

const load = () => import('./editor/rich-text-editor.tsx');
const Editor = lazy(load);

/** Starts fetching the editor chunk; safe to call any number of times. */
export function preloadEditor(): void {
  void load();
}

const GLYPHS = ['B', 'I', '@', 'Link', 'Code'];
const BLOCK_GLYPHS = ['Heading', 'List', 'Numbered', 'Checklist', 'Quote', 'Code block'];

const fallbackLayout = ({ content, toolbar }: EditorParts) => (
  <div className="flex flex-col gap-2.5">
    {content}
    {toolbar}
  </div>
);

function Fallback(props: RichTextEditorProps) {
  const { size = 'page', children = fallbackLayout } = props;
  const glyphs = props.blocks ? [...GLYPHS, ...BLOCK_GLYPHS] : GLYPHS;
  const content = props.initialDoc ? (
    <RichTextView doc={props.initialDoc} size={size} className={props.contentClassName} />
  ) : (
    <div className={proseClass(size, cx('text-tx-3', props.contentClassName))}>
      <p>{props.placeholder ?? ''}</p>
    </div>
  );
  const toolbar = (
    <div aria-hidden className="flex flex-wrap items-center gap-2.5 text-12 text-tx-3">
      {glyphs.map((glyph) => (
        <span key={glyph}>{glyph}</span>
      ))}
    </div>
  );
  return (
    <div aria-busy="true" className="contents">
      {children({ content, toolbar, ready: false })}
    </div>
  );
}

/** The rich text editor, loaded on first use. */
export function RichTextEditor(props: RichTextEditorProps) {
  return (
    <Suspense fallback={<Fallback {...props} />}>
      <Editor {...props} />
    </Suspense>
  );
}
