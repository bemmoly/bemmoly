import { mergeAttributes, Node } from '@tiptap/core';
import { attr, type DocNode } from './types.ts';

/*
 * A link to another page by id. The title is stored as it was when the link was made, so a
 * document still reads when the page is gone or the reader cannot see it; the editor shows
 * the live title when the host can resolve one. Ids, not paths, so a move or rename never
 * breaks a link and the server can rewrite the links graph from the JSON alone.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageLink: {
      insertPageLink: (attrs: { pageId: string; title: string }) => ReturnType;
    };
  }
}

export const PageLink = Node.create({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-page-id') ?? '',
        renderHTML: (attributes) => ({ 'data-page-id': attributes['pageId'] }),
      },
      title: {
        default: '',
        parseHTML: (element) => element.textContent ?? '',
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="pageLink"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'pageLink' }),
      String(node.attrs['title'] || 'Untitled'),
    ];
  },

  renderText({ node }) {
    return String(node.attrs['title'] || 'Untitled');
  },

  addCommands() {
    return {
      insertPageLink:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent([
            { type: this.name, attrs },
            { type: 'text', text: ' ' },
          ]),
    };
  },
});

const titleOf = (node: Parameters<NonNullable<DocNode['plainText']>>[0]) =>
  attr(node, 'title') || 'Untitled';

export const pageLink: DocNode = {
  name: 'pageLink',
  extensions: () => [PageLink],
  plainText: titleOf,
  references: (node) => {
    const id = attr(node, 'pageId');
    return id ? [{ kind: 'page', id }] : [];
  },
  toMarkdown: (node, context) => {
    const href = context.pageHref(attr(node, 'pageId'));
    return href ? `[${titleOf(node)}](${href})` : `[[${titleOf(node)}]]`;
  },
  toHtml: (node, context) => {
    const title = context.escape(titleOf(node));
    const href = context.pageHref(attr(node, 'pageId'));
    return href
      ? `<a class="page-link" href="${context.escape(href)}">${title}</a>`
      : `<span class="page-link">${title}</span>`;
  },
};
