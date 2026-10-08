import type { RichText } from './common.ts';

/*
 * The two things the server reads out of a ProseMirror document without the
 * editor package: the plain text shadow column that search and previews use,
 * and the people a mention node names. Node names follow the Tiptap defaults
 * the Docs editor will register, so one document shape serves both modules.
 */

interface Node {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
}

const MENTION_NODE = 'mention';

/** Block nodes end with a line break so two paragraphs never run into one word. */
const BLOCK_NODES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'tableRow',
  'horizontalRule',
]);

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The document as one string, whitespace collapsed; empty for a null document. */
export function richTextToPlain(doc: RichText | null | undefined): string {
  if (!doc) return '';
  let out = '';
  const append = (node: Node) => {
    if (typeof node.text === 'string') out += node.text;
    else if (node.type === MENTION_NODE) out += `@${String(node.attrs?.label ?? '')}`;
    else if (node.type === 'hardBreak') out += '\n';
    if (node.type && BLOCK_NODES.has(node.type)) out += '\n';
  };
  walk(doc as Node, append);
  return out.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/** User ids named by mention nodes, each once, in document order. */
export function mentionedUserIds(doc: RichText | null | undefined): string[] {
  if (!doc) return [];
  const ids: string[] = [];
  walk(doc as Node, (node) => {
    if (node.type !== MENTION_NODE) return;
    const id = node.attrs?.id;
    if (typeof id === 'string' && UUID.test(id) && !ids.includes(id)) ids.push(id);
  });
  return ids;
}
