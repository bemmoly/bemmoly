import { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { baseExtensions } from '../schema/index.ts';
import { normalizeHref } from './link-form.tsx';
import { BLOCK_TOOLS, INLINE_TOOLS, slashMatches, type Tool } from './tools.ts';

let editor: Editor;
afterEach(() => editor?.destroy());

const tool = (id: string): Tool => [...INLINE_TOOLS, ...BLOCK_TOOLS].find((t) => t.id === id)!;
const context = { openLink: vi.fn() };

function editorWith(text: string) {
  editor = new Editor({
    extensions: baseExtensions(),
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
  });
  return editor;
}

/** Selects the first occurrence of `word` in the first paragraph. */
function select(word: string) {
  const start = editor.state.doc.textContent.indexOf(word) + 1;
  editor.view.dispatch(
    editor.state.tr.setSelection(
      TextSelection.create(editor.state.doc, start, start + word.length),
    ),
  );
}

describe('tool commands', () => {
  it.each([
    ['bold', 'bold'],
    ['italic', 'italic'],
    ['code', 'code'],
  ])('%s marks the selection and reports itself active', (id, mark) => {
    editorWith('move sessions now');
    select('sessions');
    expect(tool(id).active!(editor)).toBe(false);
    tool(id).run(editor, context);
    expect(tool(id).active!(editor)).toBe(true);
    const marked = editor.getJSON().content![0]!.content![1]!;
    expect(marked).toMatchObject({ text: 'sessions', marks: [{ type: mark }] });
    tool(id).run(editor, context);
    expect(tool(id).active!(editor)).toBe(false);
  });

  it.each([
    ['heading', 'heading'],
    ['bulletList', 'bulletList'],
    ['orderedList', 'orderedList'],
    ['taskList', 'taskList'],
    ['blockquote', 'blockquote'],
    ['codeBlock', 'codeBlock'],
  ])('%s turns the paragraph into a %s and back', (id, node) => {
    editorWith('one line');
    select('one');
    tool(id).run(editor, context);
    expect(editor.getJSON().content![0]!.type).toBe(node);
    expect(tool(id).active!(editor)).toBe(true);
    tool(id).run(editor, context);
    expect(editor.getJSON().content![0]!.type).toBe('paragraph');
  });

  it('Link opens the link form rather than acting on its own', () => {
    editorWith('docs');
    tool('link').run(editor, context);
    expect(context.openLink).toHaveBeenCalledOnce();
  });

  it('@ starts a mention, with a space after a word', () => {
    editorWith('ping');
    editor.commands.focus('end');
    tool('mention').run(editor, context);
    expect(editor.state.doc.textContent).toBe('ping @');
  });
});

describe('the / menu', () => {
  it('matches block names by the start of a word', () => {
    expect(slashMatches('').length).toBe(8);
    expect(slashMatches('li').map((b) => b.label)).toEqual(['Bulleted list', 'Numbered list']);
    expect(slashMatches('CODE').map((b) => b.id)).toEqual(['codeBlock']);
    expect(slashMatches('zzz')).toEqual([]);
  });
});

describe('link addresses', () => {
  it('adds https:// to a bare host, mailto: to an address, and keeps the rest', () => {
    expect(normalizeHref('example.org/runbook')).toBe('https://example.org/runbook');
    expect(normalizeHref('ops@example.org')).toBe('mailto:ops@example.org');
    expect(normalizeHref(' /work/issue/PLT-1 ')).toBe('/work/issue/PLT-1');
    expect(normalizeHref('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});
