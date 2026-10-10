import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { writeScope } from './request.ts';
import { afterBlock, followRange, type Tracked } from './tracked.ts';
import type { AiCommand, AiHandler } from './types.ts';
import type { AiWriteStore } from './write-store.ts';

/*
 * Where the suggestion card lives: a widget between the page's blocks, after the block the
 * command started in, so the page makes room for it and nothing is covered. Like ghost text
 * it is a decoration, on this screen only; the shared document never holds the card or what
 * streams into it. The plugin follows the words a Replace would rewrite through every edit.
 */

export interface WriteTarget {
  id: number;
  /** What Replace rewrites; null once those words are gone, or for a writing command. */
  target: Tracked | null;
  /** The line the command started in. */
  anchor: Tracked | null;
  /** Where Insert writes: after the anchor's block. */
  insertAt: number;
}

type WriteMeta = { open: Omit<WriteTarget, 'insertAt'> } | { close: true };

export const aiWriteKey = new PluginKey<WriteTarget | null>('aiWrite');

function apply(tr: Transaction, value: WriteTarget | null): WriteTarget | null {
  const meta = tr.getMeta(aiWriteKey) as WriteMeta | undefined;
  if (meta && 'close' in meta) return null;
  if (meta) {
    const anchor = meta.open.anchor;
    return { ...meta.open, insertAt: afterBlock(tr.doc, anchor?.to ?? tr.selection.to) };
  }
  if (!value || !tr.docChanged) return value;
  const target = value.target && followRange(tr.doc, value.target, tr.mapping);
  const anchor = value.anchor && followRange(tr.doc, value.anchor, tr.mapping);
  const insertAt = anchor
    ? afterBlock(tr.doc, anchor.to)
    : Math.min(tr.mapping.map(value.insertAt), tr.doc.content.size);
  return { ...value, target, anchor, insertAt };
}

export function writePlugin(store: AiWriteStore, onEscape: () => void): Plugin {
  return new Plugin<WriteTarget | null>({
    key: aiWriteKey,
    state: { init: () => null, apply },
    props: {
      decorations(state) {
        const placed = aiWriteKey.getState(state);
        const session = store.get();
        if (!placed || !session || session.id !== placed.id) return null;
        return DecorationSet.create(state.doc, [
          Decoration.widget(placed.insertAt, () => session.container, {
            side: -1,
            key: `ai-write:${placed.id}`,
            ignoreSelection: true,
            stopEvent: () => true,
          }),
        ]);
      },
      handleKeyDown(_view, event) {
        if (event.key !== 'Escape' || !store.get()) return false;
        onEscape();
        return true;
      },
    },
  });
}

/** Opens the card for `command` where the person stands, and starts it writing. */
export function startWrite(
  editor: Editor,
  store: AiWriteStore,
  command: AiCommand,
  handler: AiHandler,
): void {
  const scope = writeScope(editor.state, command);
  const id = store.open(command, scope, handler);
  editor.view.dispatch(
    editor.state.tr
      .setMeta(aiWriteKey, { open: { id, target: scope.target, anchor: scope.anchor } })
      .setMeta('addToHistory', false),
  );
}

/** Closes the card: Discard, Esc, or after Insert or Replace. */
export function closeWrite(editor: Editor, store: AiWriteStore): void {
  store.close();
  if (editor.isDestroyed || !aiWriteKey.getState(editor.state)) return;
  editor.view.dispatch(
    editor.state.tr.setMeta(aiWriteKey, { close: true }).setMeta('addToHistory', false),
  );
}

export interface AiWriteOptions {
  store: AiWriteStore;
}

/** The card's extension, made with the editor; the store is shared with the card and menus. */
export function aiWrite(options: AiWriteOptions) {
  return Extension.create({
    name: 'aiWrite',
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [writePlugin(options.store, () => closeWrite(editor, options.store))];
    },
    addStorage: () => ({ store: options.store }),
  });
}

/** The editor's write store, for the / menu and the bubble to open the card from. */
export function writeStoreOf(editor: Editor): AiWriteStore | undefined {
  const storage = (editor.storage as unknown as Record<string, { store?: AiWriteStore }>)[
    'aiWrite'
  ];
  return storage?.store;
}
