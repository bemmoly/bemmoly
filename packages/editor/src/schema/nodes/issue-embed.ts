import { mergeAttributes, Node } from '@tiptap/core';
import { attr, type DocNode } from './types.ts';

/*
 * An issue, by key, drawn live: its status and title come from Work through a renderer the
 * host injects, so the editor never imports a module. Docs runs with Work disabled, and then
 * the key prints as a quiet chip. It is inline, as the Doc Editor mock draws issue chips at
 * the end of a list item.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    issueEmbed: {
      insertIssueEmbed: (key: string) => ReturnType;
    };
  }
}

export const IssueEmbed = Node.create({
  name: 'issueEmbed',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      key: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-key') ?? '',
        renderHTML: (attributes) => ({ 'data-key': attributes['key'] }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="issueEmbed"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-type': 'issueEmbed' }),
      String(node.attrs['key']),
    ];
  },

  renderText({ node }) {
    return String(node.attrs['key']);
  },

  addCommands() {
    return {
      insertIssueEmbed:
        (key) =>
        ({ commands }) =>
          commands.insertContent([
            { type: this.name, attrs: { key } },
            { type: 'text', text: ' ' },
          ]),
    };
  },
});

export const issueEmbed: DocNode = {
  name: 'issueEmbed',
  extensions: () => [IssueEmbed],
  plainText: (node) => attr(node, 'key'),
  references: (node) => {
    const key = attr(node, 'key');
    return key ? [{ kind: 'issue', key }] : [];
  },
  toMarkdown: (node, context) => {
    const key = attr(node, 'key');
    const href = context.issueHref(key);
    return href ? `[${key}](${href})` : key;
  },
  toHtml: (node, context) => {
    const key = context.escape(attr(node, 'key'));
    const href = context.issueHref(attr(node, 'key'));
    return href
      ? `<a class="issue" href="${context.escape(href)}">${key}</a>`
      : `<span class="issue">${key}</span>`;
  },
};
