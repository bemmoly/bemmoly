import { mergeAttributes, Node } from '@tiptap/core';
import { attr, type DocNode } from './types.ts';

/*
 * A saved query drawn as a table of issues. The node stores the LQL and a title; the rows
 * are fetched live by the renderer the host injects (Work's, when Work is on). Exports carry
 * the query, not a snapshot of rows, since an export is read later than it is made.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    issueTable: {
      insertIssueTable: (attrs: { query: string; title?: string }) => ReturnType;
    };
  }
}

export const IssueTable = Node.create({
  name: 'issueTable',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      query: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-query') ?? '',
        renderHTML: (attributes) => ({ 'data-query': attributes['query'] }),
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') ?? '',
        renderHTML: (attributes) =>
          attributes['title'] ? { 'data-title': attributes['title'] } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="issueTable"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'issueTable' })];
  },

  addCommands() {
    return {
      insertIssueTable:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { title: '', ...attrs } }),
    };
  },
});

const label = (node: Parameters<NonNullable<DocNode['plainText']>>[0]) =>
  attr(node, 'title') || 'Issues';

export const issueTable: DocNode = {
  name: 'issueTable',
  extensions: () => [IssueTable],
  plainText: label,
  references: (node) => {
    const query = attr(node, 'query').trim();
    return query ? [{ kind: 'issueQuery', query }] : [];
  },
  /** A fenced block in LQL, which the Markdown importer reads back as an issue table. */
  toMarkdown: (node) => {
    const title = attr(node, 'title').replace(/"/g, "'");
    return `\`\`\`lql${title ? ` title="${title}"` : ''}\n${attr(node, 'query')}\n\`\`\``;
  },
  toHtml: (node, context) =>
    `<div class="issue-table" data-type="issueTable"><p><strong>${context.escape(label(node))}</strong></p><pre><code>${context.escape(attr(node, 'query'))}</code></pre></div>`,
};
