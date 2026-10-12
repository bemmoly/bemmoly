import { getSchema } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { describe, expect, it } from 'vitest';
import { baseExtensions } from '../schema/base.ts';
import { fromMarkdownBase } from './markdown-base.ts';

describe('inline code inside emphasis', () => {
  const schema = getSchema(baseExtensions());
  it.each(['**`foo`**', '_see `bar`_', '~~`baz`~~'])('%s is a valid document', (md) => {
    expect(() => Node.fromJSON(schema, fromMarkdownBase(md)).check()).not.toThrow();
  });
});
