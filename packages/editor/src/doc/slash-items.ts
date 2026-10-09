import type { Editor, Range } from '@tiptap/core';
import type { SuggestionRow } from '../editor/suggestion-store.ts';
import { DEFAULT_AI_COMMANDS, type DocServices } from './services.ts';

/*
 * The Docs / menu: the Doc Editor mock's two groups, AI first (only when the host lends an
 * AI handler) and then Blocks. Rows filter as the person types: a row matches when a word of
 * its label or one of its keywords starts with the query, and typing a group's name ("ai")
 * lists that whole group.
 */

export interface DocSlashItem {
  id: string;
  label: string;
  group: 'AI' | 'Blocks';
  keywords?: readonly string[];
  /** Hidden when the host has not lent what the row needs. */
  available?: (services: DocServices) => boolean;
  run: (editor: Editor, range: Range, services: DocServices) => void;
}

const start = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

/** Types a trigger, so its own search opens where the slash was. */
const trigger = (char: string) => (editor: Editor, range: Range) =>
  start(editor, range).insertContent(char).run();

/** In the mock's order: the three rows it shows first, then the rest. */
const BLOCKS: readonly DocSlashItem[] = [
  {
    id: 'issueTable',
    label: 'Issue table from filter',
    group: 'Blocks',
    keywords: ['lql', 'query', 'jira'],
    run: (e, r) => start(e, r).insertIssueTable({ query: '' }).run(),
  },
  {
    id: 'decision',
    label: 'Decision',
    group: 'Blocks',
    keywords: ['decided', 'adr'],
    run: (e, r) => start(e, r).setDecision('proposed').run(),
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    group: 'Blocks',
    keywords: ['snippet', 'pre'],
    run: (e, r) => start(e, r).setCodeBlock().run(),
  },
  {
    id: 'callout',
    label: 'Callout',
    group: 'Blocks',
    keywords: ['note', 'info', 'warning', 'tip', 'panel'],
    run: (e, r) => start(e, r).setCallout('info').run(),
  },
  {
    id: 'table',
    label: 'Table',
    group: 'Blocks',
    keywords: ['grid', 'columns'],
    run: (e, r) => start(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'toc',
    label: 'Table of contents',
    group: 'Blocks',
    keywords: ['toc', 'outline'],
    run: (e, r) => start(e, r).insertToc().run(),
  },
  {
    id: 'heading',
    label: 'Heading',
    group: 'Blocks',
    keywords: ['h2', 'title'],
    run: (e, r) => start(e, r).setHeading({ level: 2 }).run(),
  },
  {
    id: 'subheading',
    label: 'Subheading',
    group: 'Blocks',
    keywords: ['h3'],
    run: (e, r) => start(e, r).setHeading({ level: 3 }).run(),
  },
  {
    id: 'bulletList',
    label: 'Bulleted list',
    group: 'Blocks',
    keywords: ['ul', 'bullet'],
    run: (e, r) => start(e, r).toggleBulletList().run(),
  },
  {
    id: 'orderedList',
    label: 'Numbered list',
    group: 'Blocks',
    keywords: ['ol', 'ordered'],
    run: (e, r) => start(e, r).toggleOrderedList().run(),
  },
  {
    id: 'taskList',
    label: 'To-do list',
    group: 'Blocks',
    keywords: ['todo', 'task', 'checklist', 'checkbox'],
    run: (e, r) => start(e, r).toggleTaskList().run(),
  },
  {
    id: 'blockquote',
    label: 'Quote',
    group: 'Blocks',
    keywords: ['blockquote'],
    run: (e, r) => start(e, r).toggleBlockquote().run(),
  },
  {
    id: 'horizontalRule',
    label: 'Divider',
    group: 'Blocks',
    keywords: ['hr', 'rule', 'separator'],
    run: (e, r) => start(e, r).setHorizontalRule().run(),
  },
  {
    id: 'image',
    label: 'Image',
    group: 'Blocks',
    keywords: ['picture', 'photo', 'upload'],
    run: (e, r) => start(e, r).setImage({ src: '', alt: '' }).run(),
  },
  {
    id: 'pageLink',
    label: 'Link to page',
    group: 'Blocks',
    keywords: ['page', 'doc', '[['],
    available: (s) => Boolean(s.searchPages),
    run: trigger('[['),
  },
  {
    id: 'mention',
    label: 'Mention a person',
    group: 'Blocks',
    keywords: ['@', 'person', 'people', 'user'],
    available: (s) => Boolean(s.searchPeople),
    run: trigger('@'),
  },
  {
    id: 'issueEmbed',
    label: 'Issue',
    group: 'Blocks',
    keywords: ['#', 'ticket', 'embed'],
    available: (s) => Boolean(s.searchIssues),
    run: trigger('#'),
  },
];

/** The context an /ai command runs with: the block's text and any selection. */
function runAi(commandId: string) {
  return (editor: Editor, range: Range, services: DocServices) => {
    start(editor, range).run();
    const { state } = editor;
    const { from, to, $from } = state.selection;
    services.ai?.run(commandId, {
      blockText: $from.parent.textContent,
      selectionText: state.doc.textBetween(from, to, '\n'),
      insertText: (text) => editor.chain().focus().insertContent(text).run(),
    });
  };
}

/** Every row the host's services allow, AI first. */
export function docSlashItems(services: DocServices): DocSlashItem[] {
  const ai = services.ai
    ? (services.ai.commands ?? DEFAULT_AI_COMMANDS).map((command): DocSlashItem => ({
        ...command,
        group: 'AI',
        run: runAi(command.id),
      }))
    : [];
  return [...ai, ...BLOCKS.filter((item) => item.available?.(services) ?? true)];
}

const words = (item: DocSlashItem) => [
  ...item.label.toLowerCase().split(/[\s-]+/),
  ...(item.keywords ?? []),
];

/** How well a row matches: its label starts with the query, a word does, or its group does. */
function rank(item: DocSlashItem, q: string): number {
  if (item.label.toLowerCase().startsWith(q)) return 0;
  if (words(item).some((word) => word.startsWith(q))) return 1;
  if (item.group.toLowerCase().startsWith(q)) return 2;
  return -1;
}

/** The rows a query keeps: AI then Blocks, as the menu groups them; best match first in each. */
export function filterSlashItems(items: readonly DocSlashItem[], query: string): DocSlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items
    .map((item, index) => ({ item, index, score: rank(item, q) }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (a, b) =>
        Number(a.item.group !== 'AI') - Number(b.item.group !== 'AI') ||
        a.score - b.score ||
        a.index - b.index,
    )
    .map((entry) => entry.item);
}

export const slashRow = (item: DocSlashItem): SuggestionRow => ({
  id: item.id,
  label: item.label,
  group: item.group,
});
