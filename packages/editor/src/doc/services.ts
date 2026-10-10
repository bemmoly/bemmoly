import type { ReactNode } from 'react';
import type { SuggestionSearch } from '../types.ts';
import type { AiHandler } from './ai/types.ts';

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

export {
  DEFAULT_AI_COMMANDS,
  DEFAULT_SELECTION_COMMANDS,
  GHOST_DEBOUNCE_MS,
  GHOST_TIMEOUT_MS,
  type AiCommand,
  type AiCommandContext,
  type AiCompleteRequest,
  type AiHandler,
  type AiWriteEvent,
  type AiWriteRequest,
} from './ai/types.ts';

export interface DocServices {
  /** Draws an issue chip live (status, title); without it the key prints as a quiet chip. */
  renderIssue?: (key: string) => ReactNode;
  /** Draws an issue as a block card (status, priority, assignee, sprint, epic). */
  renderIssueCard?: (key: string) => ReactNode;
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
  /** AI: the / menu's AI group, Ask AI and ghost text; each is hidden without it. */
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

/** The empty line's hint, as the Doc Editor mock writes it. */
export const docPlaceholder = (ai: boolean) =>
  ai ? 'Type / for blocks, /ai for help…' : 'Type / for blocks…';
