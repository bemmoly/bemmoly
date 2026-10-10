import type { Editor } from '@tiptap/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RichTextDoc } from '../types.ts';
import DocEditor from './doc-editor.tsx';
import type { DocEditorProps } from './doc-editor-props.ts';
import { COMMENT_EVENT } from './services.ts';

afterEach(cleanup);

/** ⌘ on a Mac, Ctrl elsewhere, as ProseMirror reads Mod. */
const MOD = /Mac|iP(hone|ad)/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };

const DOC: RichTextDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Redis stays warm' }] }],
};

async function setup(props: Partial<DocEditorProps> = {}) {
  render(<DocEditor label="Page body" initialDoc={DOC} {...props} />);
  const box = await screen.findByRole('textbox', { name: 'Page body' });
  const editor = (box as HTMLElement & { editor: Editor }).editor;
  return { box, editor };
}

/** Selects "Redis" with the text focused, as a drag over the word would. */
const selectWord = (editor: Editor) =>
  act(() => {
    editor.chain().focus().setTextSelection({ from: 1, to: 6 }).run();
  });

describe('the selection bubble', () => {
  it('shows the marks over a selection and none over a caret', async () => {
    const { editor } = await setup();
    expect(screen.queryByRole('toolbar', { name: 'Format' })).toBeNull();
    selectWord(editor);
    const bar = await screen.findByRole('toolbar', { name: 'Format' });
    for (const name of ['Bold', 'Italic', 'Strikethrough', 'Inline code', 'Link', 'Highlight'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(bar.textContent).not.toContain('Ask AI');
    expect(bar.textContent).not.toContain('Comment');
  });

  it('toggles a mark and reports it pressed', async () => {
    const { editor } = await setup();
    selectWord(editor);
    fireEvent.click(await screen.findByRole('button', { name: 'Highlight' }));
    expect(editor.isActive('highlight')).toBe(true);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Highlight' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
  });

  it('offers Comment and Ask AI only when the host lends them', async () => {
    const run = vi.fn();
    const { editor, box } = await setup({ services: { comments: true, ai: { run } } });
    const onComment = vi.fn();
    box.addEventListener(COMMENT_EVENT, onComment);
    selectWord(editor);
    fireEvent.click(await screen.findByRole('button', { name: /Comment/ }));
    expect(onComment).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /Ask AI/ })).toBeTruthy();
  });

  it('opens the link field on ⌘K and links the selection to an address', async () => {
    const { editor, box } = await setup();
    selectWord(editor);
    fireEvent.keyDown(box, { key: 'k', ...MOD });
    const field = await screen.findByRole('combobox', { name: 'Link address or page' });
    fireEvent.change(field, { target: { value: 'example.org' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(editor.getAttributes('link')['href']).toBe('https://example.org');
  });

  it('links to a page found by the search', async () => {
    const searchPages = vi.fn().mockResolvedValue([{ id: 'p1', label: 'Runbook' }]);
    const { editor, box } = await setup({
      services: { searchPages, pageHref: (id) => `/docs/pages/${id}` },
    });
    selectWord(editor);
    fireEvent.keyDown(box, { key: 'k', ...MOD });
    const field = await screen.findByRole('combobox', { name: 'Link address or page' });
    fireEvent.change(field, { target: { value: 'run' } });
    fireEvent.click(await screen.findByRole('option', { name: /Runbook/ }));
    expect(editor.getAttributes('link')['href']).toBe('/docs/pages/p1');
  });
});
