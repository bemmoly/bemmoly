import type { Editor } from '@tiptap/core';
import { ToastProvider } from '@bemmoly/ui';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { RichTextDoc } from '../types.ts';
import { blockAt, deleteBlock, duplicateBlock, moveBlock } from './block-commands.ts';
import DocEditor from './doc-editor.tsx';

afterEach(cleanup);

const p = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

const DOC: RichTextDoc = {
  type: 'doc',
  content: [
    p('one'),
    p('two'),
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p('first')] },
        { type: 'listItem', content: [p('second')] },
      ],
    },
  ],
};

async function setup() {
  render(
    <ToastProvider>
      <DocEditor label="Page body" initialDoc={DOC} />
    </ToastProvider>,
  );
  const box = await screen.findByRole('textbox', { name: 'Page body' });
  return { box, editor: (box as HTMLElement & { editor: Editor }).editor };
}

const texts = (editor: Editor) => {
  const out: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.isTextblock) out.push(node.textContent);
  });
  return out;
};

/** Puts the caret in the text block that reads `text`. */
function caretIn(editor: Editor, text: string) {
  let at = -1;
  editor.state.doc.descendants((node, pos) => {
    if (at < 0 && node.isTextblock && node.textContent === text) at = pos + 1;
  });
  act(() => {
    editor.chain().focus().setTextSelection(at).run();
  });
}

describe('block commands', () => {
  it('moves a top-level block past its neighbour, and a list item within its list', async () => {
    const { editor } = await setup();
    act(() => void moveBlock(editor, blockAt(editor, 1)!, 1));
    expect(texts(editor)).toEqual(['two', 'one', 'first', 'second']);
    caretIn(editor, 'second');
    act(() => void moveBlock(editor, blockAt(editor, editor.state.selection.from)!, -1));
    expect(texts(editor)).toEqual(['two', 'one', 'second', 'first']);
  });

  it('refuses to move the first block up', async () => {
    const { editor } = await setup();
    expect(moveBlock(editor, blockAt(editor, 1)!, -1)).toBe(false);
  });

  it('duplicates a block', async () => {
    const { editor } = await setup();
    act(() => void duplicateBlock(editor, blockAt(editor, 1)!));
    expect(texts(editor).slice(0, 3)).toEqual(['one', 'one', 'two']);
  });

  it('deletes a block as one undo step', async () => {
    const { editor } = await setup();
    act(() => void deleteBlock(editor, blockAt(editor, 1)!));
    expect(texts(editor)[0]).toBe('two');
    act(() => void editor.commands.undo());
    expect(texts(editor).slice(0, 2)).toEqual(['one', 'two']);
  });
});

describe('block keys and handles', () => {
  it('moves the block with Alt+Shift+arrows', async () => {
    const { box, editor } = await setup();
    caretIn(editor, 'two');
    fireEvent.keyDown(box, { key: 'ArrowUp', altKey: true, shiftKey: true });
    expect(texts(editor).slice(0, 2)).toEqual(['two', 'one']);
  });

  it('selects the block on Esc and shows its handles', async () => {
    const { box, editor } = await setup();
    caretIn(editor, 'one');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(await screen.findByRole('button', { name: 'Add a block below' })).toBeTruthy();
    const grip = screen.getByRole('button', { name: /Move or change this paragraph/ });
    fireEvent.click(grip);
    fireEvent.click(await screen.findByRole('menuitem', { name: /Delete/ }));
    await waitFor(() => expect(texts(editor)[0]).toBe('two'));
    expect(await screen.findByText('Block deleted')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(texts(editor).slice(0, 2)).toEqual(['one', 'two']));
  });
});
