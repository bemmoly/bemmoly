import type { Editor, JSONContent } from '@tiptap/core';
import { ownUndoStep } from './undo-step.ts';
import { aiWriteKey } from './write-plugin.ts';

/*
 * Insert and Replace: the card's Markdown becomes page content in one transaction, so it is
 * one change in the shared document and one step of undo. The Markdown reader loads only
 * here, the first time a person accepts a suggestion.
 */

export type ApplyMode = 'insert' | 'replace';

const loadMarkdown = () => import('../../convert/from-markdown.ts');

/** Starts fetching the Markdown reader while the card streams, so Insert is instant. */
export function preloadMarkdown(): void {
  void loadMarkdown();
}

async function blocksOf(markdown: string): Promise<JSONContent[]> {
  const { fromMarkdown } = await loadMarkdown();
  return (fromMarkdown(markdown).content ?? []) as JSONContent[];
}

/** A paragraph's inline content, when the whole result is one paragraph. */
function inlineOf(blocks: JSONContent[]): JSONContent[] | null {
  const [only] = blocks;
  if (blocks.length !== 1 || only?.type !== 'paragraph') return null;
  return only.content ?? [];
}

/** Writes `markdown` into the page; false when where it should go is gone. */
export async function applyWrite(
  editor: Editor,
  markdown: string,
  mode: ApplyMode,
): Promise<boolean> {
  const blocks = await blocksOf(markdown);
  const placed = editor.isDestroyed ? null : aiWriteKey.getState(editor.state);
  if (!placed || !blocks.length) return false;
  // One chain is one transaction: one change in the shared document, one step of undo.
  const chain = editor
    .chain()
    .focus()
    .command(({ tr, state }) => Boolean(ownUndoStep(state, tr)));
  if (mode === 'insert') {
    return chain.insertContentAt(placed.insertAt, blocks, { updateSelection: true }).run();
  }
  const target = placed.target;
  if (!target) return false;
  const $from = editor.state.doc.resolve(target.from);
  const $to = editor.state.doc.resolve(target.to);
  const oneLine = $from.parent === $to.parent && $from.parent.isTextblock;
  const inline = inlineOf(blocks);
  if (oneLine && inline) {
    return chain.insertContentAt({ from: target.from, to: target.to }, inline).run();
  }
  // The whole line, or more than one: the blocks themselves are replaced.
  const whole = oneLine && target.from === $from.start() && target.to === $to.end();
  const range = whole
    ? { from: $from.before($from.depth), to: $to.after($to.depth) }
    : { from: target.from, to: target.to };
  return chain.insertContentAt(range, blocks).run();
}
