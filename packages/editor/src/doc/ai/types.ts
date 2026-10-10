/*
 * What a host lends the Docs editor for AI. The editor never calls a model: it asks the host
 * to write or continue, shows what comes back as lilac AI output, and puts nothing in the
 * document until the person accepts it.
 */

/**
 * One /ai command: a row in the / menu's AI group or the selection bubble's Ask AI menu.
 * "generate" writes new text after the block (Continue writing); "transform" rewrites the
 * selection, or the block at a bare caret (Improve writing), and so may also Replace.
 */
export interface AiCommand {
  id: string;
  label: string;
  kind?: 'generate' | 'transform';
  /** Handled by the host itself (a panel of its own) instead of the suggestion card. */
  run?: (context: AiCommandContext) => void;
}

/** What a host-handled command is run with. */
export interface AiCommandContext {
  /** The text of the block the menu was opened in, and the selection if there was one. */
  blockText: string;
  selectionText: string;
  /** Inserts text at the caret, as the person would have typed it. */
  insertText: (text: string) => void;
}

/** What the suggestion card asks the host to write. */
export interface AiWriteRequest {
  commandId: string;
  /** The text the command works on: the selection, or the block at a bare caret. */
  targetText: string;
  /** The section around it: from the heading above to the next heading. */
  sectionText: string;
  /** The heading above the caret; empty when there is none. */
  heading: string;
}

/** A streamed write: text deltas, then the run they came from (for "Not useful"). */
export type AiWriteEvent = { type: 'text'; text: string } | { type: 'done'; runId: string | null };

/** What ghost text asks the host to continue. */
export interface AiCompleteRequest {
  /** Up to 2,000 characters before the caret, and up to 500 after it. */
  before: string;
  after: string;
}

export interface AiHandler {
  /** The / menu's AI group; DEFAULT_AI_COMMANDS when absent. */
  commands?: readonly AiCommand[];
  /** The selection bubble's Ask AI menu; DEFAULT_SELECTION_COMMANDS when absent. */
  selectionCommands?: readonly AiCommand[];
  /**
   * Streams a command's output, in Markdown, into the suggestion card. Nothing reaches the
   * page until the person chooses Insert or Replace.
   */
  write?: (request: AiWriteRequest, signal: AbortSignal) => AsyncIterable<AiWriteEvent>;
  /**
   * Ghost text: a short continuation of the text before the caret, or null. The editor
   * aborts the signal on the next keystroke and after GHOST_TIMEOUT_MS.
   */
  complete?: (request: AiCompleteRequest, signal: AbortSignal) => Promise<string | null>;
  /** Ghost text is offered only while this is true: the person's own toggle, say. */
  ghostText?: boolean;
  /** Honest copy for a failed write, such as the provider's rate limit in plain words. */
  describeError?: (error: unknown) => string;
  /** The person marked a run's output Not useful. */
  notUseful?: (runId: string) => void;
}

/** The AI group of the Doc Editor mock's / menu, then the writing commands. */
export const DEFAULT_AI_COMMANDS: readonly AiCommand[] = [
  { id: 'continue', label: 'Continue writing', kind: 'generate' },
  { id: 'summarize-comments', label: 'Summarize open questions from comments', kind: 'generate' },
  { id: 'create-issues', label: 'Create issues from this section', kind: 'generate' },
  { id: 'summarize', label: 'Summarize this section', kind: 'generate' },
  { id: 'draft', label: 'Draft from heading', kind: 'generate' },
  { id: 'improve', label: 'Improve writing', kind: 'transform' },
  { id: 'shorten', label: 'Make shorter', kind: 'transform' },
  { id: 'fix-grammar', label: 'Fix spelling and grammar', kind: 'transform' },
  { id: 'translate', label: 'Translate to English', kind: 'transform' },
  { id: 'table', label: 'Turn into a table', kind: 'transform' },
];

/** Ask AI over a selection: the commands that work on the words chosen. */
export const DEFAULT_SELECTION_COMMANDS: readonly AiCommand[] = [
  { id: 'improve', label: 'Improve writing', kind: 'transform' },
  { id: 'shorten', label: 'Make shorter', kind: 'transform' },
  { id: 'fix-grammar', label: 'Fix spelling and grammar', kind: 'transform' },
  { id: 'translate', label: 'Translate to English', kind: 'transform' },
  { id: 'table', label: 'Turn into a table', kind: 'transform' },
  { id: 'summarize', label: 'Summarize', kind: 'generate' },
  { id: 'continue', label: 'Continue writing', kind: 'generate' },
];

/** How long ghost text waits for the fast model before it drops the request, silently. */
export const GHOST_TIMEOUT_MS = 1500;

/** How long typing must pause before ghost text asks for a continuation. */
export const GHOST_DEBOUNCE_MS = 450;
