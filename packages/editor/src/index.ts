/**
 * `@bemmoly/editor`: the rich text editor every module shares. This entry is light: the
 * read-only view, the types and lazy editors whose ProseMirror code loads on first use (the
 * comment and description editor, and the Docs page editor). The schema, for reading
 * documents outside an editor, is `@bemmoly/editor/schema`; text extraction, the links
 * graph and Markdown, HTML and Confluence conversion are `@bemmoly/editor/convert`.
 */
export { headingIds } from './convert/outline.ts';
export { isEmptyDoc } from './doc.ts';
export { mountedDom } from './mounted-dom.ts';
export type { DocEditorProps } from './doc/doc-editor-props.ts';
export {
  COMMENT_EVENT,
  COMMENT_KEYS,
  DEFAULT_AI_COMMANDS,
  docPlaceholder,
  type AiCommand,
  type AiCommandContext,
  type AiHandler,
  type DocServices,
  type IssueTableAttrs,
  type UploadedImage,
} from './doc/services.ts';
export type { EditorParts, RichTextEditorProps } from './editor-props.ts';
export { DocEditor, preloadDocEditor } from './lazy-doc.tsx';
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
