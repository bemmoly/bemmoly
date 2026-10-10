/** One node of a stored document, in ProseMirror's JSON shape. */
export interface RichTextNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNode[];
}

/** A stored document: what the editor reads and writes, and what the view prints. */
export interface RichTextDoc {
  type: 'doc';
  content?: RichTextNode[];
}

/** One row of a suggestion list: a person for @, a record for #. */
export interface SuggestionItem {
  /** The person's id, or the record's key. */
  id: string;
  label: string;
  /** A second line, such as an email or an issue title. */
  description?: string;
}

/** Server search, shaped like the searchable Select's: abandon the work when `signal` aborts. */
export type SuggestionSearch = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly SuggestionItem[]>;

/**
 * Links to records by key, typed as `#` and a search, or as the key itself. Modules supply
 * these: Work links issues, so the editor never knows what an issue is.
 */
export interface ReferenceSource {
  /** A whole key, such as /^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/ for issues. */
  pattern: RegExp;
  /** Where a key links to. */
  hrefFor: (key: string) => string;
  search: SuggestionSearch;
  /** Names the list for assistive technology: "Issues". */
  label: string;
}

/** What the editor can search while someone writes. */
export interface EditorSources {
  /** People for @mentions. */
  people?: SuggestionSearch;
  references?: ReferenceSource;
}

/**
 * page: the Issue page (14px at 1.65). panel: the drawer (13px at 1.6). comment: 13px.
 * doc: a Docs page (15.5px at 1.7).
 */
export type ProseSize = 'page' | 'panel' | 'comment' | 'doc';
