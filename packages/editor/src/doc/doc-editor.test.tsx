import type { Editor } from '@tiptap/core';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVERY_DOC_NODE } from '../testing/doc-fixture.ts';
import type { RichTextDoc } from '../types.ts';
import DocEditor from './doc-editor.tsx';
import type { DocEditorProps } from './doc-editor-props.ts';
import type { DocServices } from './services.ts';

afterEach(cleanup);

async function setup(props: Partial<DocEditorProps> = {}) {
  const onChange = vi.fn<(doc: RichTextDoc | null) => void>();
  render(<DocEditor label="Page body" onChange={onChange} {...props} />);
  const box = await screen.findByRole('textbox', { name: 'Page body' });
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

const optionNames = () => screen.getAllByRole('option').map((option) => option.textContent);

describe('the / menu', () => {
  it('opens on / with the Blocks group, and no AI group without an AI handler', async () => {
    const { editor } = await setup();
    type(editor, '/');
    const menu = await screen.findByRole('listbox', { name: 'Blocks' });
    expect(within(menu).queryByRole('group', { name: 'AI' })).toBeNull();
    expect(optionNames().slice(0, 3)).toEqual([
      'Issue table from filter',
      'Decision',
      'Code block',
    ]);
    expect(optionNames()).not.toContain('Link to page');
  });

  it('shows the AI group first when the host lends a handler, and /ai lists it', async () => {
    const run = vi.fn();
    const { box, editor } = await setup({ services: { ai: { run } } });
    type(editor, '/');
    await screen.findByRole('group', { name: 'AI' });
    expect(optionNames()[0]).toBe('Continue writing');
    type(editor, 'ai');
    await waitFor(() =>
      expect(optionNames()).toEqual([
        'Continue writing',
        'Summarize open questions from comments',
        'Create issues from this section',
        'Check consistency with linked issues',
      ]),
    );
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(run).toHaveBeenCalledWith('continue', expect.objectContaining({ blockText: '' }));
  });

  it('filters as you type and inserts the chosen block from the keyboard', async () => {
    const { box, editor, onChange } = await setup();
    type(editor, '/todo');
    await waitFor(() => expect(optionNames()).toEqual(['To-do list']));
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(editor.getJSON().content?.[0]?.type).toBe('taskList');
    expect(onChange).toHaveBeenCalled();
  });

  it('moves with the arrows and inserts a callout', async () => {
    const { box, editor } = await setup();
    type(editor, '/call');
    await waitFor(() => expect(optionNames()).toEqual(['Callout']));
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(editor.getJSON().content?.[0]?.type).toBe('callout'));
    expect(await screen.findByRole('button', { name: /Info callout, change style/ })).toBeTruthy();
  });

  it('says so when nothing matches', async () => {
    const { editor } = await setup();
    type(editor, '/zzz');
    expect(await screen.findByText('No matches')).toBeTruthy();
  });

  it('inserts a table with a header row and shows its tools', async () => {
    const { box, editor } = await setup();
    type(editor, '/table');
    await waitFor(() => expect(optionNames()[0]).toBe('Table'));
    fireEvent.keyDown(box, { key: 'Enter' });
    const table = (editor.getJSON() as RichTextDoc).content?.[0];
    expect(table?.type).toBe('table');
    expect(table?.content?.[0]?.content?.[0]?.type).toBe('tableHeader');
    const tools = await screen.findByRole('toolbar', { name: 'Table' });
    fireEvent.click(within(tools).getByRole('button', { name: 'Row below' }));
    const rows = () => (editor.getJSON() as RichTextDoc).content?.[0]?.content ?? [];
    expect(rows()).toHaveLength(4);
    fireEvent.click(within(tools).getByRole('button', { name: 'Delete column' }));
    expect(rows()[0]?.content).toHaveLength(2);
  });
});

describe('Docs nodes in the editor', () => {
  it('loads every Docs node and draws issues as placeholders without Work', async () => {
    const { editor } = await setup({ initialDoc: EVERY_DOC_NODE });
    expect(editor.getJSON()).toEqual(EVERY_DOC_NODE);
    expect(await screen.findByTitle('PLT-204 (issue details unavailable)')).toBeTruthy();
    expect(screen.getByText('Live issues appear here when Work is enabled.')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Contents' }).textContent).toContain('Owners');
  });

  it('draws issues through the host renderer when one is lent', async () => {
    const services: DocServices = {
      renderIssue: (key) => <span>live {key}</span>,
      renderIssueTable: ({ query }) => <div>table of {query}</div>,
    };
    await setup({ initialDoc: EVERY_DOC_NODE, services });
    expect(await screen.findByText('live PLT-204')).toBeTruthy();
    expect(screen.getByText('table of project = PLT AND status != Done')).toBeTruthy();
  });

  it('changes a callout variant from its menu as one step', async () => {
    const { editor } = await setup({ initialDoc: EVERY_DOC_NODE });
    fireEvent.click(await screen.findByRole('button', { name: /Info callout/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Warning/ }));
    await waitFor(() =>
      expect(editor.getJSON().content?.[1]?.attrs).toEqual({ variant: 'warning' }),
    );
  });

  it('inserts an issue embed from the # search when the host lends one', async () => {
    const searchIssues = vi.fn(async () => [{ id: 'PLT-218', label: 'PLT-218' }]);
    const { box, editor } = await setup({ services: { searchIssues } });
    type(editor, 'see #rot');
    await screen.findByRole('option', { name: /PLT-218/ });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() =>
      expect(editor.getJSON().content?.[0]?.content?.[1]).toEqual({
        type: 'issueEmbed',
        attrs: { key: 'PLT-218' },
      }),
    );
  });

  it('prints read-only when not editable', async () => {
    const { editor } = await setup({ initialDoc: EVERY_DOC_NODE, editable: false });
    expect(editor.isEditable).toBe(false);
    expect(screen.queryByRole('button', { name: /Info callout/ })).toBeNull();
  });
});
