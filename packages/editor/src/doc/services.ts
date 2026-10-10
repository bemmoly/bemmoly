import type { ReactNode } from 'react';
import type { SuggestionSearch } from '../types.ts';

/*
 * What a host lends the Docs editor and view. Everything is optional, and the editor never
 * imports a module: Work lends the issue renderers when it is on, the Docs module lends page
 * search and uploads, the AI runtime lends the /ai commands. Without one, the matching
 * nodes draw a quiet placeholder and the matching menu rows are hidden.
 */

export interface IssueTableAttrs {
  /** The saved query, in LQL. */
  query: string;
  title: string;
}

export interface UploadedImage {
  src: string;
  alt?: string;
}

/** One /ai command: a row in the menu's AI group. */
export interface AiCommand {
  id: string;
  label: string;
}

/** What an /ai command is run with. */
export interface AiCommandContext {
  /** The text of the block the menu was opened in, and the selection if there was one. */
  blockText: string;
  selectionText: string;
  /** Inserts text at the caret, as the person would have typed it. */
  insertText: (text: string) => void;
}

export interface AiHandler {
  /** The rows of the AI group; the Doc Editor mock's four when absent. */
  commands?: readonly AiCommand[];
  run: (commandId: string, context: AiCommandContext) => void;
}

export interface DocServices {
  /** Draws an issue chip live (status, title); without it the key prints as a quiet chip. */
  renderIssue?: (key: string) => ReactNode;
  /** Draws a saved query as a live table; without it a placeholder card shows the query. */
  renderIssueTable?: (attrs: IssueTableAttrs) => ReactNode;
  /** Pages for `[[` links. */
  searchPages?: SuggestionSearch;
  /** Where a page link goes; clicks call onNavigate with it. */
  pageHref?: (pageId: string) => string;
  /** Issues for `#` embeds. */
  searchIssues?: SuggestionSearch;
  /** People for @mentions. */
  searchPeople?: SuggestionSearch;
  /** Stores a file and returns its URL; without it images are added by link only. */
  uploadImage?: (file: File) => Promise<UploadedImage>;
  /** The /ai commands; the AI group is hidden without it. */
  ai?: AiHandler;
  /** A link click inside the page, so in-app paths move without a reload. */
  onNavigate?: (href: string) => void;
  /**
   * True when the host takes comments on a selection: the selection bubble then shows
   * Comment, which dispatches COMMENT_EVENT on the text box for the host to answer.
   */
  comments?: boolean;
}

/** What the bubble's Comment button dispatches on the editor's DOM; the host starts a comment. */
export const COMMENT_EVENT = 'bemmoly:comment';

/** The Comment shortcut, as the host binds it. */
export const COMMENT_KEYS = 'Mod-Alt-m';

/** The AI group of the Doc Editor mock's menu. */
export const DEFAULT_AI_COMMANDS: readonly AiCommand[] = [
  { id: 'continue', label: 'Continue writing' },
  { id: 'summarize-comments', label: 'Summarize open questions from comments' },
  { id: 'create-issues', label: 'Create issues from this section' },
  { id: 'check-consistency', label: 'Check consistency with linked issues' },
];

/** The empty line's hint, as the Doc Editor mock writes it. */
export const docPlaceholder = (ai: boolean) =>
  ai ? 'Type / for blocks, /ai for help…' : 'Type / for blocks…';
