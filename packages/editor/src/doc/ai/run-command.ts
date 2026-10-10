import type { Editor } from '@tiptap/core';
import type { AiCommand, AiHandler } from './types.ts';
import { startWrite, writeStoreOf } from './write-plugin.ts';

/**
 * Runs an /ai command from the / menu or Ask AI: the host's own handler when the command has
 * one, otherwise the suggestion card, which streams the host's `write` into it.
 */
export function runAiCommand(editor: Editor, command: AiCommand, ai: AiHandler | undefined) {
  if (!ai) return;
  if (command.run) {
    const { from, to, $from } = editor.state.selection;
    command.run({
      blockText: $from.parent.textContent,
      selectionText: editor.state.doc.textBetween(from, to, '\n'),
      insertText: (text) => editor.chain().focus().insertContent(text).run(),
    });
    return;
  }
  const store = writeStoreOf(editor);
  if (store && ai.write) startWrite(editor, store, command, ai);
}
