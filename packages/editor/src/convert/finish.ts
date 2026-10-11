import { Node } from '@tiptap/pm/model';
import { editorSchema } from '../schema/index.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';

/*
 * Every importer ends here: the JSON it built is loaded into the schema, which fills default
 * attributes, orders marks, joins neighbouring text and rejects anything invalid, then is
 * written back. An import is therefore exactly what the editor would have saved.
 */
export function finish(content: RichTextNode[]): RichTextDoc {
  const doc = Node.fromJSON(editorSchema(), {
    type: 'doc',
    content: content.length ? content : [{ type: 'paragraph' }],
  });
  doc.check();
  return doc.toJSON() as RichTextDoc;
}
