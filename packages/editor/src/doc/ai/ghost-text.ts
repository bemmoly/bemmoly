import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { GHOST_DEBOUNCE_MS, GHOST_TIMEOUT_MS, type AiHandler } from './types.ts';
import { ownUndoStep } from './undo-step.ts';

/*
 * Ghost text: when typing pauses at the end of a line, the host's fast model is asked how the
 * sentence goes on, and the answer is drawn after the caret in lilac. It is a decoration, a
 * picture on this screen only: the document, and so the shared Yjs document every
 * collaborator sees, never holds it. Tab writes it in as one edit; Esc, any other key, a
 * click or losing focus drops it. A request still out when the person types is aborted, and
 * one slower than GHOST_TIMEOUT_MS is dropped without a word.
 */

interface GhostState {
  /** The continuation on screen, or null. */
  text: string | null;
  /** Where it is drawn: the caret it was asked for. */
  pos: number;
  /** The line's text before the caret when it was drawn, to know it still belongs there. */
  tail: string;
  /** Counts this person's own edits; a change starts the debounce again. */
  edits: number;
}

type GhostMeta = { show: { text: string; pos: number } } | { clear: true };

const TAIL = 40;
/** Up to TAIL characters of the caret's own line before it. */
function tailAt(doc: Transaction['doc'], pos: number): string {
  const $pos = doc.resolve(Math.min(pos, doc.content.size));
  if (!$pos.parent.isTextblock) return '';
  return doc.textBetween(Math.max($pos.start(), pos - TAIL), pos, '\n', ' ');
}

export const ghostTextKey = new PluginKey<GhostState>('aiGhostText');

/** y-prosemirror marks the edits it applies from other people with this meta. */
const REMOTE_META = 'y-sync$';

const remote = (tr: Transaction) =>
  Boolean((tr.getMeta(REMOTE_META) as { isChangeOrigin?: boolean } | undefined)?.isChangeOrigin);

/** At least this much of the line must be written before a continuation is worth asking. */
const MIN_LINE = 12;
const MAX_GHOST = 240;

function apply(tr: Transaction, value: GhostState): GhostState {
  const meta = tr.getMeta(ghostTextKey) as GhostMeta | undefined;
  if (meta && 'show' in meta) {
    const { text, pos } = meta.show;
    return { ...value, text, pos, tail: tailAt(tr.doc, pos) };
  }
  if (meta) return value.text === null ? value : { ...value, text: null };
  if (tr.docChanged && !remote(tr)) return { ...value, text: null, edits: value.edits + 1 };
  if (value.text === null) return value;
  // An edit from the shared document (someone else's, or a Yjs undo): the caret is restored
  // after it, and the ghost follows only if the words before the caret are still the same.
  if (tr.docChanged) {
    const head = tr.selection.head;
    const same = tr.selection.empty && tailAt(tr.doc, head) === value.tail;
    return same ? { ...value, pos: head } : { ...value, text: null };
  }
  return tr.selectionSet ? { ...value, text: null } : value;
}

/** One line, trimmed of what a model adds around it, never longer than a sentence or two. */
export function tidyGhost(text: string | null | undefined): string | null {
  const line = (text ?? '').split('\n')[0]?.replace(/\s+$/, '') ?? '';
  if (!line.trim()) return null;
  return line.length > MAX_GHOST ? line.slice(0, MAX_GHOST) : line;
}

function ghostDom(text: string): HTMLElement {
  const span = document.createElement('span');
  span.setAttribute('data-ghost-text', '');
  span.setAttribute('aria-hidden', 'true');
  span.className = 'pointer-events-none text-ai-600 select-none';
  span.textContent = text;
  const key = document.createElement('kbd');
  key.className =
    'ml-1.5 rounded-chip border border-ai-100 bg-ai-50 px-1 py-px align-middle font-sans text-11 leading-none text-ai-600';
  key.textContent = 'Tab';
  span.append(key);
  return span;
}

/** The text ghost text continues: the caret at the end of a written line, outside code. */
function askable(state: EditorState): { before: string; after: string; head: number } | null {
  const { selection, doc } = state;
  if (!selection.empty) return null;
  const { $head, head } = selection;
  const block = $head.parent;
  if (!block.isTextblock || block.type.spec.code) return null;
  if ($head.parentOffset !== block.content.size) return null;
  if (block.textContent.trim().length < MIN_LINE) return null;
  return {
    head,
    before: doc.textBetween(Math.max(0, head - 2000), head, '\n', ' '),
    after: doc.textBetween(head, Math.min(doc.content.size, head + 500), '\n', ' '),
  };
}

export interface GhostTextOptions {
  /** The host's AI as it is now; ghost text sleeps while it lends no `complete`. */
  handler: () => AiHandler | undefined;
}

function ghostPlugin(options: GhostTextOptions): Plugin<GhostState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inflight: AbortController | undefined;
  const cancel = () => {
    clearTimeout(timer);
    inflight?.abort();
    inflight = undefined;
  };

  async function ask(view: EditorView) {
    const handler = options.handler();
    if (!handler?.complete || handler.ghostText === false || !view.editable) return;
    const state = view.state;
    const at = askable(state);
    if (!at) return;
    const controller = new AbortController();
    inflight = controller;
    const timeout = setTimeout(() => controller.abort(), GHOST_TIMEOUT_MS);
    let text: string | null;
    try {
      text = tidyGhost(
        await handler.complete({ before: at.before, after: at.after }, controller.signal),
      );
    } catch {
      return;
    } finally {
      clearTimeout(timeout);
    }
    if (controller.signal.aborted || inflight !== controller || view.isDestroyed) return;
    inflight = undefined;
    if (!text || view.state.doc !== state.doc || view.state.selection.head !== at.head) return;
    view.dispatch(
      view.state.tr
        .setMeta(ghostTextKey, { show: { text, pos: at.head } })
        .setMeta('addToHistory', false),
    );
  }

  const clear = (view: EditorView) =>
    view.dispatch(view.state.tr.setMeta(ghostTextKey, { clear: true }));

  return new Plugin<GhostState>({
    key: ghostTextKey,
    state: {
      init: () => ({ text: null, pos: 0, tail: '', edits: 0 }),
      apply,
    },
    view: () => ({
      update(view, previous) {
        const now = ghostTextKey.getState(view.state);
        const before = ghostTextKey.getState(previous);
        if (now && before && now.edits !== before.edits) {
          cancel();
          timer = setTimeout(() => void ask(view), GHOST_DEBOUNCE_MS);
        } else if (!view.state.selection.eq(previous.selection)) {
          cancel();
        }
      },
      destroy: cancel,
    }),
    props: {
      decorations(state) {
        const ghost = ghostTextKey.getState(state);
        if (!ghost?.text) return null;
        const text = ghost.text;
        return DecorationSet.create(state.doc, [
          Decoration.widget(ghost.pos, () => ghostDom(text), {
            side: 1,
            key: `ghost:${text}`,
            ignoreSelection: true,
          }),
        ]);
      },
      handleKeyDown(view, event) {
        cancel();
        const ghost = ghostTextKey.getState(view.state);
        if (!ghost?.text) return false;
        const bare = !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey;
        if (event.key === 'Tab' && bare) {
          const tr = view.state.tr.insertText(ghost.text, ghost.pos);
          view.dispatch(ownUndoStep(view.state, tr).setMeta(ghostTextKey, { clear: true }));
          return true;
        }
        if (event.key === 'Escape') {
          clear(view);
          return true;
        }
        return false;
      },
      handleDOMEvents: {
        blur(view) {
          cancel();
          if (ghostTextKey.getState(view.state)?.text) clear(view);
          return false;
        },
      },
    },
  });
}

/**
 * The ghost text extension, made with the editor (never registered on a live one: that
 * breaks the collaboration binding). Its priority puts Tab and Esc ahead of the list keys.
 */
export function ghostText(options: GhostTextOptions) {
  return Extension.create({
    name: 'aiGhostText',
    priority: 1000,
    addProseMirrorPlugins: () => [ghostPlugin(options)],
  });
}
