import type { AnyExtension, Editor } from '@tiptap/core';
import type { RichTextDoc } from '../types.ts';
import type { DocServices } from './services.ts';

export interface DocEditorProps {
  /** The document to start from; the editor is uncontrolled after that. */
  initialDoc?: RichTextDoc | null | undefined;
  /** Every change, as the stored shape; null when nothing is written. */
  onChange?: ((doc: RichTextDoc | null) => void) | undefined;
  /** The text box's accessible name: "Page body". */
  label: string;
  /** The empty line's hint; by default the mock's "Type / for blocks, /ai for help…". */
  placeholder?: string | undefined;
  /** What the host lends: issue renderers, page and people search, uploads, AI. */
  services?: DocServices | undefined;
  /** False prints the page read-only through the same node views. Default true. */
  editable?: boolean | undefined;
  autoFocus?: boolean | undefined;
  /**
   * More extensions, made once with the editor: collaboration and cursors, for instance.
   * When one of them supplies the content, leave initialDoc out.
   */
  extensions?: readonly AnyExtension[] | undefined;
  /** The editor once it exists, and null when it is gone, for hosts that drive it. */
  onEditor?: ((editor: Editor | null) => void) | undefined;
  /** Classes on the text itself, such as a minimum height. */
  contentClassName?: string | undefined;
}
