import { Extension, type Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';

/*
 * What a block handle and its keys do to one block: move it past its neighbour, duplicate it,
 * delete it, select it. "A block" is a list item when the caret is in a list (so ⌥⇧↑ reorders
 * steps), and otherwise the top-level block. Each is one transaction, so one undo reverts it,
 * and with collaboration on, Yjs undo reverts only the person's own move.
 */

export interface BlockRef {
  /** Where the block starts in the document. */
  pos: number;
  node: PMNode;
}

const ITEMS = new Set(['listItem', 'taskItem']);

/** The block around a position: the innermost list item, else the top-level block. */
export function blockAt(editor: Editor, at: number): BlockRef | null {
  const { doc } = editor.state;
  const $pos = doc.resolve(Math.min(Math.max(at, 0), doc.content.size));
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (ITEMS.has($pos.node(depth).type.name))
      return { pos: $pos.before(depth), node: $pos.node(depth) };
  }
  if ($pos.depth === 0) {
    const node = doc.nodeAt(at);
    return node ? { pos: at, node } : null;
  }
  return { pos: $pos.before(1), node: $pos.node(1) };
}

/** The block the selection is in (or the selected block itself). */
export function selectedBlock(editor: Editor): BlockRef | null {
  const { selection } = editor.state;
  if (selection instanceof NodeSelection) return { pos: selection.from, node: selection.node };
  return blockAt(editor, selection.from);
}

/** Moves a block past its previous (-1) or next (+1) sibling, keeping the caret inside it. */
export function moveBlock(editor: Editor, block: BlockRef, dir: -1 | 1): boolean {
  const { state } = editor;
  const $pos = state.doc.resolve(block.pos);
  const index = $pos.index();
  const parent = $pos.parent;
  const sibling = parent.maybeChild(index + dir);
  if (!sibling) return false;
  const offset = state.selection.from - block.pos;
  const tr = state.tr.delete(block.pos, block.pos + block.node.nodeSize);
  const target = dir < 0 ? block.pos - sibling.nodeSize : block.pos + sibling.nodeSize;
  tr.insert(target, block.node);
  const caret = Math.min(target + Math.max(offset, 1), tr.doc.content.size);
  tr.setSelection(
    block.node.isAtom || block.node.isLeaf
      ? NodeSelection.create(tr.doc, target)
      : TextSelection.near(tr.doc.resolve(caret)),
  );
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function duplicateBlock(editor: Editor, block: BlockRef): boolean {
  const end = block.pos + block.node.nodeSize;
  const tr = editor.state.tr.insert(end, block.node.copy(block.node.content));
  tr.setSelection(TextSelection.near(tr.doc.resolve(end + 1)));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export function deleteBlock(editor: Editor, block: BlockRef): boolean {
  editor.view.dispatch(editor.state.tr.delete(block.pos, block.pos + block.node.nodeSize));
  editor.commands.focus();
  return true;
}

/** Selects the whole block, as Esc does: the handle then shows for it. */
export function selectBlock(editor: Editor, block: BlockRef): boolean {
  editor.view.dispatch(
    editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, block.pos)),
  );
  return true;
}

/** ⌥⇧↑ ⌥⇧↓ move the block, ⌘D duplicates it, Esc selects it (unless a list is open). */
export const blockKeys = (listOpen: () => boolean) =>
  Extension.create({
    name: 'blockKeys',
    addKeyboardShortcuts() {
      const run = (action: (block: BlockRef) => boolean) => () => {
        const block = selectedBlock(this.editor);
        return this.editor.isEditable && block ? action(block) : false;
      };
      return {
        'Alt-Shift-ArrowUp': run((block) => moveBlock(this.editor, block, -1)),
        'Alt-Shift-ArrowDown': run((block) => moveBlock(this.editor, block, 1)),
        'Mod-d': run((block) => duplicateBlock(this.editor, block)),
        Escape: () => {
          if (listOpen() || this.editor.state.selection instanceof NodeSelection) return false;
          return run((block) => selectBlock(this.editor, block))();
        },
      };
    },
  });
