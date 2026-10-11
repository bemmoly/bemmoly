import { Extension, type Editor } from '@tiptap/core';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DocEditor from './doc-editor.tsx';

afterEach(cleanup);

const names = (editor: Editor) => editor.extensionManager.extensions.map((ext) => ext.name);

async function mount(extensions?: Extension[]) {
  render(<DocEditor label="Page body" extensions={extensions} />);
  const box = await screen.findByRole('textbox', { name: 'Page body' });
  return (box as HTMLElement & { editor: Editor }).editor;
}

describe('undo history', () => {
  it('keeps ProseMirror history for a page edited alone', async () => {
    expect(names(await mount())).toContain('undoRedo');
  });

  it('leaves it out when a collaboration extension supplies the document and undo', async () => {
    const collaboration = Extension.create({ name: 'collaboration' });
    const editor = await mount([collaboration]);
    expect(names(editor)).toContain('collaboration');
    expect(names(editor)).not.toContain('undoRedo');
  });
});
