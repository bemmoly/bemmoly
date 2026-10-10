import { closeHistory } from '@tiptap/pm/history';
import type { EditorState, Transaction } from '@tiptap/pm/state';

/*
 * Accepted AI text is its own step of undo, never merged into the typing just before it.
 * A page edited alone keeps ProseMirror's history; a shared page has Yjs undo instead, whose
 * manager the collaboration binding keeps in its plugin state. The editor does not depend on
 * that binding, so the state is read by its plugin key's name.
 */

const Y_UNDO = 'y-undo$';

interface YUndoState {
  undoManager?: { stopCapturing?: () => void };
}

/** Marks `tr` as the start of a new undo step in whichever history the editor has. */
export function ownUndoStep(state: EditorState, tr: Transaction): Transaction {
  const yUndo = (state as unknown as Record<string, YUndoState | undefined>)[Y_UNDO];
  yUndo?.undoManager?.stopCapturing?.();
  return closeHistory(tr);
}
