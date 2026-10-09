import { mergeAttributes, Node } from '@tiptap/core';
import { attr, type DocNode } from './types.ts';

/*
 * What an import could not map: a Confluence macro this build has no node for, say. It keeps
 * the source's name for it and the original markup, and shows a labelled block where it
 * stood, so nothing is dropped without the reader seeing that it was there.
 */

const dataAttribute = (name: string) => ({
  default: '',
  parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`) ?? '',
  renderHTML: (attributes: Record<string, unknown>) => ({ [`data-${name}`]: attributes[name] }),
});

export const UnsupportedBlock = Node.create({
  name: 'unsupportedBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      /** Where it came from: "confluence". */
      source: dataAttribute('source'),
      /** The source's name for it: the macro's name. */
      name: dataAttribute('name'),
      /** The original markup, kept so a later build can map it. */
      raw: dataAttribute('raw'),
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="unsupportedBlock"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'unsupportedBlock' }),
      unsupportedLabel(String(node.attrs['source']), String(node.attrs['name'])),
    ];
  },
});

const SOURCES: Record<string, string> = { confluence: 'Confluence', markdown: 'Markdown' };

/** "Confluence macro: jira-chart", the label the block shows and exports print. */
export function unsupportedLabel(source: string, name: string): string {
  const from = SOURCES[source] ?? (source || 'Imported');
  return `${from} ${source === 'confluence' ? 'macro' : 'block'}: ${name || 'unknown'}`;
}

const label = (node: Parameters<NonNullable<DocNode['plainText']>>[0]) =>
  unsupportedLabel(attr(node, 'source'), attr(node, 'name'));

export const unsupportedBlock: DocNode = {
  name: 'unsupportedBlock',
  extensions: () => [UnsupportedBlock],
  plainText: () => '',
  toMarkdown: (node) => `> ${label(node)} (not imported)`,
  toHtml: (node, context) =>
    `<div class="unsupported" data-type="unsupportedBlock">${context.escape(label(node))} (not imported)</div>`,
};
