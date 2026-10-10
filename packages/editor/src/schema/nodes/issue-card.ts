import { mergeAttributes, Node } from '@tiptap/core';
import { attr, type DocNode } from './types.ts';

/*
 * An issue as a block: the card embed of the Docs review's Linked work tab, with status,
 * priority, assignee, sprint and epic drawn live by the host (Work, when it is on). The node
 * stores the key only, like the inline issue embed beside it; with Work off it prints as the
 * key. It is a new node, so every document written before it loads unchanged.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    issueCard: {
      /** An empty key asks for the issue in place. */
      insertIssueCard: (key: string) => ReturnType;
    };
  }
}

export const IssueCard = Node.create({
  name: 'issueCard',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

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
    return [{ tag: 'div[data-type="issueCard"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'issueCard' }),
      String(node.attrs['key']),
    ];
  },

  renderText({ node }) {
    return String(node.attrs['key']);
  },

  addCommands() {
    return {
      insertIssueCard:
        (key) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { key } }),
    };
  },
});

export const issueCard: DocNode = {
  name: 'issueCard',
  extensions: () => [IssueCard],
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
    const inner = href ? `<a href="${context.escape(href)}">${key}</a>` : key;
    return `<p class="issue-card">${inner}</p>`;
  },
};
