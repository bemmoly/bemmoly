import { attr, type DocNode } from './types.ts';

/*
 * A person, by id, with the name they had when mentioned. The node itself is the base set's
 * (Work's comments and descriptions mention people too), so this entry adds only what Docs
 * reads out of it: the text, the person it points at, and how it exports.
 */

const labelOf = (node: Parameters<NonNullable<DocNode['plainText']>>[0]) =>
  `@${attr(node, 'label') || attr(node, 'id')}`;

export const mention: DocNode = {
  name: 'mention',
  extensions: () => [],
  plainText: labelOf,
  references: (node) => {
    const id = attr(node, 'id');
    return id ? [{ kind: 'user', id }] : [];
  },
  toMarkdown: labelOf,
  toHtml: (node, context) =>
    `<span class="mention" data-type="mention">${context.escape(labelOf(node))}</span>`,
};
