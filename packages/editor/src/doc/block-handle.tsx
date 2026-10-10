import { focusRing, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Editor } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { useEffect, useState, type DragEvent, type RefObject } from 'react';
import { cx } from '../cx.ts';
import { useEditorState } from '../editor/use-editor.ts';
import { blockAt, type BlockRef } from './block-commands.ts';
import { BlockMenu, GripTip } from './block-menu.tsx';

/*
 * The margin handles of the Docs review's Writing tab: + adds a block below and opens the /
 * menu there; the grip drags the block (ProseMirror's own drop, with the accent drop line) and
 * opens the block menu. They show for the hovered block and for a selected block (Esc selects
 * the block the caret is in), so the keyboard reaches them too. Read-only pages have none.
 */

const BUTTON = cx(
  'grid h-6.25 w-5.5 cursor-pointer place-items-center rounded-panel border-0 bg-transparent p-0 text-tx-3',
  'hover:bg-hover hover:text-tx-2 aria-expanded:bg-hover aria-expanded:text-tx-2',
  focusRing,
);

/** The block under the pointer, found at the text column's left edge on the pointer's line. */
function blockUnder(editor: Editor, y: number): BlockRef | null {
  const box = editor.view.dom.getBoundingClientRect();
  const hit = editor.view.posAtCoords({ left: box.left + 4, top: y });
  if (!hit) return null;
  return blockAt(editor, hit.inside >= 0 ? hit.inside : hit.pos);
}

/** The selected block, when the person selected one whole (Esc, or a click on an atom). */
function selected(editor: Editor): BlockRef | null {
  const { selection } = editor.state;
  return selection instanceof NodeSelection ? { pos: selection.from, node: selection.node } : null;
}

function useHovered(editor: Editor, frame: RefObject<HTMLElement | null>) {
  const [hovered, setHovered] = useState<BlockRef | null>(null);
  useEffect(() => {
    const host = frame.current;
    if (!host) return undefined;
    const move = (event: PointerEvent) => {
      if (editor.isDestroyed || !editor.isEditable) return;
      if ((event.target as Element).closest?.('[data-block-handle]')) return;
      // The block stays put while its menu is open.
      if (host.querySelector('[data-block-handle] [aria-expanded="true"]')) return;
      const next = blockUnder(editor, event.clientY);
      setHovered((current) => (current?.pos === next?.pos ? current : next));
    };
    const leave = () => setHovered(null);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
    };
  }, [editor, frame]);
  return hovered;
}

/** Adds an empty paragraph below the block and types / there, so the menu opens. */
function addBelow(editor: Editor, block: BlockRef) {
  const end = block.pos + block.node.nodeSize;
  const paragraph = editor.schema.nodes['paragraph']!.create();
  const tr = editor.state.tr.insert(end, paragraph);
  tr.setSelection(TextSelection.create(tr.doc, end + 1));
  editor.view.dispatch(tr);
  editor.chain().focus().insertContent('/').run();
}

/** Starts ProseMirror's own drag of the block, so the drop line and the move are its. */
function startDrag(editor: Editor, block: BlockRef, event: DragEvent<HTMLButtonElement>) {
  const { view } = editor;
  const selection = NodeSelection.create(view.state.doc, block.pos);
  view.dispatch(view.state.tr.setSelection(selection));
  const dom = view.nodeDOM(block.pos);
  if (dom instanceof HTMLElement) event.dataTransfer.setDragImage(dom, 0, 0);
  event.dataTransfer.effectAllowed = 'move';
  const slice = selection.content();
  event.dataTransfer.setData('text/plain', slice.content.textBetween(0, slice.content.size, '\n'));
  view.dragging = { slice, move: true };
}

export function BlockHandle({
  editor,
  frame,
}: {
  editor: Editor;
  frame: RefObject<HTMLElement | null>;
}) {
  useEditorState(editor);
  const hovered = useHovered(editor, frame);
  const block = hovered ?? selected(editor);
  const host = frame.current;
  if (!block || !host || !editor.isEditable || editor.isDestroyed) return null;
  const dom = editor.view.nodeDOM(block.pos);
  if (!(dom instanceof HTMLElement)) return null;
  const box = dom.getBoundingClientRect();
  const origin = host.getBoundingClientRect();
  const line = parseFloat(getComputedStyle(dom).lineHeight) || 25;
  const top = box.top - origin.top + Math.max(0, (Math.min(line, box.height) - 25) / 2);
  const name = block.node.type.name;
  return (
    <div
      data-block-handle=""
      role="group"
      aria-label="Block"
      style={{ top, left: box.left - origin.left - 52 }}
      // No margin to hold them on a phone; the / menu and the bubble remain.
      className="absolute z-10 flex gap-px max-sm:hidden"
    >
      <Tooltip label="Add a block below" keys="/">
        <button
          type="button"
          aria-label="Add a block below"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => addBelow(editor, block)}
          className={BUTTON}
        >
          <Icon name="plus" size={15} />
        </button>
      </Tooltip>
      <BlockMenu
        editor={editor}
        block={block}
        trigger={(props) => (
          <GripTip>
            <button
              type="button"
              {...props}
              aria-label={`Move or change this ${name === 'paragraph' ? 'paragraph' : 'block'}`}
              draggable
              onDragStart={(event) => startDrag(editor, block, event)}
              className={cx(BUTTON, 'cursor-grab active:cursor-grabbing')}
            >
              <Icon name="drag" size={14} />
            </button>
          </GripTip>
        )}
      />
    </div>
  );
}
