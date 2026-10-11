import type { Editor } from '@tiptap/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EditorSources, RichTextDoc, RichTextNode } from '../types.ts';
import RichTextEditor from './rich-text-editor.tsx';

afterEach(cleanup);

const AISHA = '0199c0de-0000-7000-8000-000000000001';
const ISSUE_KEY = /^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/;

const sources: EditorSources = {
  people: vi.fn(async (query: string) =>
    [{ id: AISHA, label: 'Aisha K.', description: 'aisha@example.org' }].filter((p) =>
      p.label.toLowerCase().startsWith(query.toLowerCase()),
    ),
  ),
  references: {
    pattern: ISSUE_KEY,
    hrefFor: (key) => `/work/issue/${key}`,
    label: 'Issues',
    search: vi.fn(async () => [{ id: 'PLT-204', label: 'PLT-204', description: 'Dual-write' }]),
  },
};

/** Renders the editor and waits for its view; returns the Tiptap instance behind the text box. */
async function setup(props: Partial<Parameters<typeof RichTextEditor>[0]> = {}) {
  const onChange = vi.fn<(doc: RichTextDoc | null) => void>();
  render(<RichTextEditor label="Comment" sources={sources} onChange={onChange} {...props} />);
  const box = await screen.findByRole('textbox', { name: 'Comment' });
  const editor = (box as HTMLElement & { editor: Editor }).editor;
  return { box, editor, onChange };
}

const type = (editor: Editor, text: string) =>
  act(() => {
    for (const char of text) {
      const { from, to } = editor.state.selection;
      const handled = editor.view.someProp('handleTextInput', (f) =>
        f(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to)),
      );
      if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to));
    }
  });

describe('RichTextEditor', () => {
  it('is a named, multi-line text box with a named toolbar that controls it', async () => {
    const { box } = await setup();
    expect(box.getAttribute('aria-multiline')).toBe('true');
    const toolbar = screen.getByRole('toolbar', { name: 'Comment formatting' });
    expect(toolbar.getAttribute('aria-controls')).toBe(box.id);
  });

  it('gives the toolbar one tab stop and moves between tools with arrows, Home and End', async () => {
    await setup({ blocks: true });
    const tools = screen.getAllByRole('button');
    expect(tools.filter((tool) => tool.tabIndex === 0)).toHaveLength(1);
    act(() => tools[0]!.focus());
    fireEvent.keyDown(tools[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tools[1]);
    fireEvent.keyDown(tools[1]!, { key: 'End' });
    expect(document.activeElement).toBe(tools[tools.length - 1]);
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tools[0]);
    fireEvent.keyDown(tools[0]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tools[tools.length - 1]);
    expect(tools.filter((tool) => tool.tabIndex === 0)).toEqual([tools[tools.length - 1]]);
  });

  it('reports the state of each toggle with aria-pressed', async () => {
    const { editor } = await setup();
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(bold.getAttribute('aria-pressed')).toBe('false');
    act(() => {
      editor.commands.insertContent('loud');
      editor.commands.selectAll();
    });
    fireEvent.click(bold);
    expect(bold.getAttribute('aria-pressed')).toBe('true');
  });

  it('inserts a mention from the @ search and reports the document', async () => {
    const { box, editor, onChange } = await setup();
    type(editor, 'hi @ai');
    const option = await screen.findByRole('option', { name: /Aisha K\./ });
    expect(box.getAttribute('aria-activedescendant')).toBe(option.id);
    expect(screen.getByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    const paragraph = editor.getJSON().content![0]!;
    expect(paragraph.content).toEqual([
      { type: 'text', text: 'hi ' },
      { type: 'mention', attrs: { id: AISHA, label: 'Aisha K.', mentionSuggestionChar: '@' } },
      { type: 'text', text: ' ' },
    ]);
    expect(onChange).toHaveBeenLastCalledWith(editor.getJSON());
    expect(box.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('links an issue chosen from the # search', async () => {
    const { box, editor } = await setup();
    type(editor, 'see #dual');
    await screen.findByRole('option', { name: /PLT-204/ });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(editor.getJSON().content![0]!.content![1]).toMatchObject({
      text: 'PLT-204',
      marks: [{ type: 'link', attrs: { href: '/work/issue/PLT-204' } }],
    });
  });

  it('links an issue key when it is typed, and leaves code alone', async () => {
    const { editor } = await setup();
    type(editor, 'blocked by PLT-211, ');
    const [, linked, rest] = editor.getJSON().content![0]!.content!;
    expect(linked).toMatchObject({
      text: 'PLT-211',
      marks: [{ attrs: { href: '/work/issue/PLT-211' } }],
    });
    expect(rest).toEqual({ type: 'text', text: ', ' });
    act(() => {
      editor.commands.setContent('');
      editor.commands.toggleCode();
    });
    type(editor, 'PLT-9 ');
    expect(editor.getJSON().content![0]!.content![0]!.marks).toEqual([{ type: 'code' }]);
  });

  it('links issue keys in pasted text', async () => {
    const { editor } = await setup();
    act(() => editor.view.pasteText('PLT-204 and PLT-218 merged'));
    const parts = editor.getJSON().content![0]!.content! as RichTextNode[];
    expect(
      parts.filter((part) => part.marks?.[0]?.type === 'link').map((part) => part.text),
    ).toEqual(['PLT-204', 'PLT-218']);
  });

  it('sends with ⌘↵ and cancels with Escape', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const { box } = await setup({ onSubmit, onCancel });
    const mac = /Mac|iP(hone|ad)/.test(navigator.platform);
    fireEvent.keyDown(box, { key: 'Enter', ...(mac ? { metaKey: true } : { ctrlKey: true }) });
    expect(onSubmit).toHaveBeenCalledOnce();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('reports null once everything is deleted', async () => {
    const { editor, onChange } = await setup({
      initialDoc: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
      },
    });
    act(() => {
      editor.commands.selectAll();
      editor.commands.deleteSelection();
    });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
