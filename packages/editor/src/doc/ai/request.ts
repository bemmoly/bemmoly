import type { EditorState } from '@tiptap/pm/state';
import { trackRange, type Tracked } from './tracked.ts';
import type { AiCommand, AiWriteRequest } from './types.ts';

/*
 * What an /ai command is about, read from where the person stands: the selection, or the
 * block under a bare caret; the heading above it and the section that heading opens.
 */

/** Context sent with a command, enough for a section and never a whole long page. */
const SECTION_LIMIT = 8000;

export interface WriteScope {
  request: AiWriteRequest;
  /** What Replace rewrites; null for a command that only writes new text. */
  target: Tracked | null;
  /** The line the command started in: Insert writes after its block. */
  anchor: Tracked;
}

/** The heading above `pos` and the text of its section, top-level blocks only. */
function section(state: EditorState, pos: number): { heading: string; text: string } {
  const { doc } = state;
  const index = doc.resolve(pos).index(0);
  let start = 0;
  let level = 0;
  let heading = '';
  for (let at = Math.min(index, doc.childCount - 1); at >= 0; at -= 1) {
    const node = doc.child(at);
    if (node.type.name === 'heading') {
      start = at;
      level = Number(node.attrs['level'] ?? 1);
      heading = node.textContent;
      break;
    }
  }
  let end = doc.childCount;
  for (let at = start + 1; at < doc.childCount; at += 1) {
    const node = doc.child(at);
    if (node.type.name === 'heading' && Number(node.attrs['level'] ?? 1) <= (level || 6)) {
      end = at;
      break;
    }
  }
  const parts: string[] = [];
  for (let at = start; at < end; at += 1) parts.push(doc.child(at).textContent);
  return { heading, text: parts.join('\n').slice(0, SECTION_LIMIT) };
}

export function writeScope(state: EditorState, command: AiCommand): WriteScope {
  const { selection, doc } = state;
  const { $from, $to } = selection;
  const block = $from.parent.isTextblock
    ? trackRange(doc, $from.start(), $from.end())
    : trackRange(doc, selection.from, selection.from);
  const last = $to.parent.isTextblock ? trackRange(doc, $to.start(), $to.end()) : block;
  const chosen = selection.empty ? block : trackRange(doc, selection.from, selection.to);
  const around = section(state, selection.from);
  const transform = command.kind === 'transform';
  return {
    request: {
      commandId: command.id,
      targetText: chosen.text.slice(0, SECTION_LIMIT),
      sectionText: around.text,
      heading: around.heading,
    },
    target: transform && chosen.text.trim() ? chosen : null,
    anchor: last,
  };
}
