import { Editor } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { afterEach, describe, expect, it } from 'vitest';
import { EVERY_NODE } from '../testing/fixture.ts';
import { baseExtensions, editorSchema } from './index.ts';

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
      Node.fromJSON(editorSchema(), { type: 'doc', content: [{ type: 'issueTable' }] }),
    ).toThrow();
  });
});
