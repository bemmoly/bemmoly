/**
 * `@bemmoly/editor`: the rich text editor every module shares. This entry is light: the
 * read-only view, the types and a lazy editor whose ProseMirror code loads on first use. The
 * schema, for reading documents outside an editor, is `@bemmoly/editor/schema`.
 */
export { isEmptyDoc } from './doc.ts';
export type { EditorParts, RichTextEditorProps } from './editor-props.ts';
export { preloadEditor, RichTextEditor } from './lazy.tsx';
export { proseClass } from './prose.ts';
export type {
  EditorSources,
  ProseSize,
  ReferenceSource,
  RichTextDoc,
  RichTextNode,
  SuggestionItem,
  SuggestionSearch,
} from './types.ts';
export { RichTextView, SAFE_HREF, type RichTextViewProps } from './view.tsx';
