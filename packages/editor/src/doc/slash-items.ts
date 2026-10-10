import type { IconName } from '@bemmoly/ui/icons';
import type { Editor, Range } from '@tiptap/core';
import type { SuggestionRow } from '../editor/suggestion-store.ts';
import { BLOCK_TYPES } from './block-types.ts';
import { DEFAULT_AI_COMMANDS, type DocServices } from './services.ts';

/*
 * The Docs / menu of the review's Writing tab: Basic blocks first, then AI in lilac (only when
 * the host lends an AI handler), Insert, and From Work (only the rows whose search the host
 * lends). Each row has an icon, a second line and its Markdown shortcut. Rows filter as the
 * person types: a row matches when a word of its label or one of its keywords starts with the
 * query, and typing a group's name ("ai") lists that whole group.
 */

export type SlashGroup = 'Basic blocks' | 'AI' | 'Insert' | 'From Work';

export const SLASH_GROUPS: readonly SlashGroup[] = ['Basic blocks', 'AI', 'Insert', 'From Work'];

export interface DocSlashItem {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  group: SlashGroup;
  /** The Markdown that makes the same block, drawn as a key at the row's end. */
  markdown?: string;
  keywords?: readonly string[];
  /** Hidden when the host has not lent what the row needs. */
  available?: (services: DocServices) => boolean;
  run: (editor: Editor, range: Range, services: DocServices) => void;
}

const start = (editor: Editor, range: Range) => editor.chain().focus().deleteRange(range);

/** Types a trigger, so its own search opens where the slash was. */
const trigger = (char: string) => (editor: Editor, range: Range) =>
  start(editor, range).insertContent(char).run();

const KEYWORDS: Record<string, readonly string[]> = {
  text: ['paragraph', 'plain'],
  heading: ['h2', 'title'],
  subheading: ['h3'],
  bulletList: ['ul', 'bullet'],
  orderedList: ['ol', 'ordered'],
  taskList: ['todo', 'task', 'checklist', 'checkbox'],
  blockquote: ['blockquote'],
};

const BASIC: readonly DocSlashItem[] = BLOCK_TYPES.filter((type) => type.id !== 'codeBlock').map(
  (type) => ({
    id: type.id,
    label: type.label,
    description: type.description,
    icon: type.icon,
    group: 'Basic blocks',
    ...(type.markdown ? { markdown: type.markdown } : {}),
    keywords: KEYWORDS[type.id] ?? [],
    run: (e, r) => type.turn(start(e, r)).run(),
  }),
);

const INSERT: readonly DocSlashItem[] = [
  {
    id: 'table',
    label: 'Table',
    description: 'Rows and columns',
    icon: 'table',
    group: 'Insert',
    keywords: ['grid', 'columns'],
    run: (e, r) => start(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'callout',
    label: 'Callout',
    description: 'Make a note stand out',
    icon: 'callout',
    group: 'Insert',
    keywords: ['note', 'info', 'warning', 'tip', 'panel'],
    run: (e, r) => start(e, r).setCallout('info').run(),
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    description: 'With a language and copy',
    icon: 'code',
    group: 'Insert',
    markdown: '```',
    keywords: ['snippet', 'pre'],
    run: (e, r) => start(e, r).setCodeBlock().run(),
  },
  {
    id: 'decision',
    label: 'Decision',
    description: 'What was decided, and its state',
    icon: 'decision',
    group: 'Insert',
    keywords: ['decided', 'adr'],
    run: (e, r) => start(e, r).setDecision('proposed').run(),
  },
  {
    id: 'image',
    label: 'Image',
    description: 'A picture, by upload or link',
    icon: 'image',
    group: 'Insert',
    keywords: ['picture', 'photo', 'upload'],
    run: (e, r) => start(e, r).setImage({ src: '', alt: '' }).run(),
  },
  {
    id: 'horizontalRule',
    label: 'Divider',
    description: 'A line between sections',
    icon: 'divider',
    group: 'Insert',
    markdown: '---',
    keywords: ['hr', 'rule', 'separator'],
    run: (e, r) => start(e, r).setHorizontalRule().run(),
  },
  {
    id: 'toc',
    label: 'Table of contents',
    description: 'The page outline, kept current',
    icon: 'outline',
    group: 'Insert',
    keywords: ['toc', 'outline'],
    run: (e, r) => start(e, r).insertToc().run(),
  },
  {
    id: 'pageLink',
    label: 'Link to page',
    description: 'Another page, by title',
    icon: 'page',
    group: 'Insert',
    markdown: '[[',
    keywords: ['page', 'doc', '[['],
    available: (s) => Boolean(s.searchPages),
    run: trigger('[['),
  },
  {
    id: 'mention',
    label: 'Mention a person',
    description: 'They get a notification',
    icon: 'at',
    group: 'Insert',
    markdown: '@',
    keywords: ['@', 'person', 'people', 'user'],
    available: (s) => Boolean(s.searchPeople),
    run: trigger('@'),
  },
];

const FROM_WORK: readonly DocSlashItem[] = [
  {
    id: 'issueEmbed',
    label: 'Issue',
    description: 'A live issue inside the line',
    icon: 'subtask',
    group: 'From Work',
    markdown: '#',
    keywords: ['#', 'ticket', 'embed'],
    available: (s) => Boolean(s.searchIssues),
    run: trigger('#'),
  },
  {
    id: 'issueCard',
    label: 'Issue card',
    description: 'Status, priority, assignee and sprint',
    icon: 'board',
    group: 'From Work',
    keywords: ['ticket', 'card', 'block'],
    available: (s) => Boolean(s.searchIssues),
    run: (e, r) => start(e, r).insertIssueCard('').run(),
  },
  {
    id: 'issueTable',
    label: 'Issue table from filter',
    description: 'Issues matching a query, live',
    icon: 'filter',
    group: 'From Work',
    keywords: ['lql', 'query', 'jira'],
    run: (e, r) => start(e, r).insertIssueTable({ query: '' }).run(),
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

/** Every row the host's services allow, in the menu's group order. */
export function docSlashItems(services: DocServices): DocSlashItem[] {
  const ai = services.ai
    ? (services.ai.commands ?? DEFAULT_AI_COMMANDS).map((command): DocSlashItem => ({
        ...command,
        description: 'Writes with AI; you review it first',
        icon: 'spark',
        group: 'AI',
        run: runAi(command.id),
      }))
    : [];
  return [...BASIC, ...ai, ...INSERT, ...FROM_WORK].filter(
    (item) => item.available?.(services) ?? true,
  );
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

/** The rows a query keeps, grouped as the menu draws them; best match first in each group. */
export function filterSlashItems(items: readonly DocSlashItem[], query: string): DocSlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  const order = (item: DocSlashItem) => SLASH_GROUPS.indexOf(item.group);
  return items
    .map((item, index) => ({ item, index, score: rank(item, q) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => order(a.item) - order(b.item) || a.score - b.score || a.index - b.index)
    .map((entry) => entry.item);
}

export const slashRow = (item: DocSlashItem): SuggestionRow => ({
  id: item.id,
  label: item.label,
  description: item.description,
  group: item.group,
  icon: item.icon,
  ...(item.markdown ? { hint: item.markdown } : {}),
  ...(item.group === 'AI' ? { tone: 'ai' as const } : {}),
});
