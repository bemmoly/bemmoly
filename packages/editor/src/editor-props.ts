import type { ReactNode } from 'react';
import type { EditorSources, ProseSize, RichTextDoc } from './types.ts';

/** The two pieces a host lays out: the text, and the tool row (or the link form). */
export interface EditorParts {
  content: ReactNode;
  toolbar: ReactNode;
  /** False until the editor has loaded; hosts keep their submit buttons off until then. */
  ready: boolean;
}

export interface RichTextEditorProps {
  /** The document to start from; the editor is uncontrolled after that. */
  initialDoc?: RichTextDoc | null | undefined;
  /** Every change, as the stored shape; null when nothing is written. */
  onChange?: (doc: RichTextDoc | null) => void;
  /** The text box's accessible name: "Description", "Add a comment". */
  label: string;
  placeholder?: string | undefined;
  /** Adds the block tools (heading, lists, checklist, quote, code block) to the tool row. */
  blocks?: boolean;
  sources?: EditorSources | undefined;
  autoFocus?: boolean;
  /** ⌘↵ or Ctrl+↵. */
  onSubmit?: () => void;
  /** Escape, when no suggestion list is open. */
  onCancel?: () => void;
  size?: ProseSize;
  /** Extra classes on the text itself, such as a minimum height. */
  contentClassName?: string;
  /** Lays out the parts; by default the tool row sits under the text. */
  children?: (parts: EditorParts) => ReactNode;
}
