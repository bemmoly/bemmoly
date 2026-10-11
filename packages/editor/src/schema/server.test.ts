// @vitest-environment node
import { Node } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import { EVERY_DOC_NODE } from '../testing/doc-fixture.ts';
import { editorSchema } from './index.ts';

/* The server loads the schema to extract text and export pages: no DOM, no React. */
describe('the schema on the server', () => {
  it('builds and reads every Docs node without a DOM', () => {
    expect(typeof document).toBe('undefined');
    const doc = Node.fromJSON(editorSchema(), EVERY_DOC_NODE);
    expect(doc.toJSON()).toEqual(EVERY_DOC_NODE);
  });
});
