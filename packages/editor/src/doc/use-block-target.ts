import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { blockAt, type BlockRef } from './block-commands.ts';

/** Where the margin handles sit, in px from the frame's top left corner. */
export interface HandlePlace {
  top: number;
  left: number;
}

/** The block whose menu is open, and where its handles stood when the menu opened. */
export interface HeldBlock extends HandlePlace {
  block: BlockRef;
}

/** The block under the pointer, found at the text column's left edge on the pointer's line. */
function blockUnder(editor: Editor, y: number): BlockRef | null {
  const box = editor.view.dom.getBoundingClientRect();
  const hit = editor.view.posAtCoords({ left: box.left + 4, top: y });
  if (!hit) return null;
  return blockAt(editor, hit.inside >= 0 ? hit.inside : hit.pos);
}

/** Beside the block's first line, in the 52px margin left of the text column. */
export function placeBeside(
  editor: Editor,
  block: BlockRef,
  host: HTMLElement,
): HandlePlace | null {
  const dom = editor.view.nodeDOM(block.pos);
  if (!(dom instanceof HTMLElement)) return null;
  const box = dom.getBoundingClientRect();
  const origin = host.getBoundingClientRect();
  const line = parseFloat(getComputedStyle(dom).lineHeight) || 25;
  const top = box.top - origin.top + Math.max(0, (Math.min(line, box.height) - 25) / 2);
  return { top, left: box.left - origin.left - 52 };
}

/** The held block where it is after others' edits (or an Undo) moved it; gone if deleted. */
function remap(held: HeldBlock, transaction: Transaction): HeldBlock | null {
  const result = transaction.mapping.mapResult(held.block.pos);
  const node = result.deleted ? null : transaction.doc.nodeAt(result.pos);
  return node ? { ...held, block: { pos: result.pos, node } } : null;
}

/**
 * The block the margin handles serve: the one under the pointer, or, while its menu is open,
 * the one the menu was opened for. The menu is portalled out of the frame, so reaching it
 * leaves the frame; were the handles to follow the pointer then, they would unmount the open
 * menu under it. So while a menu is open the handles hold their block and their place, and
 * let the pointer go only once it closes.
 */
export function useBlockTarget(editor: Editor, frame: RefObject<HTMLElement | null>) {
  const [hovered, setHovered] = useState<BlockRef | null>(null);
  const [held, setHeld] = useState<HeldBlock | null>(null);
  // Read by the native pointer listeners, which outlive any one render.
  const holding = useRef<HeldBlock | null>(null);
  const leftWhileHeld = useRef(false);

  useEffect(() => {
    const host = frame.current;
    if (!host) return undefined;
    const move = (event: PointerEvent) => {
      if (holding.current) {
        leftWhileHeld.current = false;
        return;
      }
      if (editor.isDestroyed || !editor.isEditable) return;
      if ((event.target as Element).closest?.('[data-block-handle]')) return;
      const next = blockUnder(editor, event.clientY);
      setHovered((current) => (current?.pos === next?.pos ? current : next));
    };
    const leave = () => {
      if (holding.current) leftWhileHeld.current = true;
      else setHovered(null);
    };
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
    };
  }, [editor, frame]);

  /** Holds the block while its menu is open; on close, lets go of a pointer that left. */
  const hold = useCallback((next: HeldBlock | null) => {
    holding.current = next;
    setHeld(next);
    if (next || !leftWhileHeld.current) return;
    leftWhileHeld.current = false;
    setHovered(null);
  }, []);

  const isHeld = held !== null;
  useEffect(() => {
    if (!isHeld) return undefined;
    // A block deleted under its open menu lets go, and the menu goes with its handles.
    const follow = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged && holding.current) hold(remap(holding.current, transaction));
    };
    editor.on('transaction', follow);
    return () => {
      editor.off('transaction', follow);
    };
  }, [editor, isHeld, hold]);

  return { hovered, held, hold };
}
