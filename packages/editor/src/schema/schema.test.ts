import { Editor } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { afterEach, describe, expect, it } from 'vitest';
import { EVERY_DOC_NODE } from '../testing/doc-fixture.ts';
import { EVERY_NODE } from '../testing/fixture.ts';
import { baseExtensions, docExtensions, editorSchema } from './index.ts';

let editor: Editor | null = null;
afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('the document schema', () => {
  it('loads every node and mark and writes the same JSON back', () => {
    const doc = Node.fromJSON(editorSchema(), EVERY_NODE);
    expect(doc.toJSON()).toEqual(EVERY_NODE);
  });

  it('round-trips through an editor unchanged', () => {
    editor = new Editor({ extensions: baseExtensions(), content: EVERY_NODE });
    expect(editor.getJSON()).toEqual(EVERY_NODE);
  });

  it('reads documents stored with only the attributes the server wrote', () => {
    const stored = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: 'u1', label: 'Jonas' } },
            { type: 'text', text: ' ok' },
          ],
        },
        {
          type: 'taskList',
          content: [{ type: 'taskItem', content: [{ type: 'paragraph' }] }],
        },
      ],
    };
    const json = Node.fromJSON(editorSchema(), stored).toJSON();
    expect(json.content[0].content[0].attrs).toMatchObject({ id: 'u1', label: 'Jonas' });
    expect(json.content[1].content[0].attrs).toEqual({ checked: false });
  });

  it('rejects node types the schema does not have', () => {
    expect(() =>
      Node.fromJSON(editorSchema(), { type: 'doc', content: [{ type: 'kanbanBoard' }] }),
    ).toThrow();
  });

  it('loads every Docs node and writes the same JSON back', () => {
    const doc = Node.fromJSON(editorSchema(), EVERY_DOC_NODE);
    doc.check();
    expect(doc.toJSON()).toEqual(EVERY_DOC_NODE);
  });

  it('round-trips every Docs node through an editor unchanged', () => {
    editor = new Editor({ extensions: docExtensions(), content: EVERY_DOC_NODE });
    expect(editor.getJSON()).toEqual(EVERY_DOC_NODE);
  });

  it('round-trips every Docs node through the HTML the schema renders', () => {
    editor = new Editor({ extensions: docExtensions(), content: EVERY_DOC_NODE });
    const html = editor.getHTML();
    editor.destroy();
    editor = new Editor({ extensions: docExtensions(), content: html });
    expect(editor.getJSON()).toEqual(EVERY_DOC_NODE);
  });

  it("keeps the base set free of Docs nodes, so Work's editors are unchanged", () => {
    editor = new Editor({ extensions: baseExtensions() });
    expect(Object.keys(editor.schema.nodes)).not.toContain('callout');
    expect(Object.keys(editor.schema.nodes)).not.toContain('table');
  });

  it('reads strike and highlight, and keeps them through HTML', () => {
    const marked = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'gone', marks: [{ type: 'strike' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'noted', marks: [{ type: 'highlight' }] },
          ],
        },
      ],
    };
    expect(Node.fromJSON(editorSchema(), marked).toJSON()).toEqual(marked);
    editor = new Editor({ extensions: docExtensions(), content: marked });
    const html = editor.getHTML();
    expect(html).toContain('<mark>noted</mark>');
    editor.destroy();
    editor = new Editor({ extensions: docExtensions(), content: html });
    expect(editor.getJSON()).toEqual(marked);
  });
});
