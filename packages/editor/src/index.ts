/**
 * `@bemmoly/editor`: the rich text editor every module shares. This entry is light: the
 * read-only view and the types. The schema, for reading documents outside an editor, is
 * `@bemmoly/editor/schema`.
 */
export { isEmptyDoc } from './doc.ts';
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
