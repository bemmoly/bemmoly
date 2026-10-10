import { DocEditor, preloadDocEditor, type AiHandler, type AiWriteEvent } from '@bemmoly/editor';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Doc } from 'yjs';
import { collabExtensions, seedLocal } from '../../../collab/extensions.ts';
import type { CollabSession } from '../../../collab/session.ts';
import { collabUser } from '../../../collab/user.ts';
import type { PageEditor as Editor } from '../../screen-context.ts';

/*
 * AI on a shared page: what the editor shows as ghost text or in the suggestion card is never
 * in the Yjs document, so collaborators never see it; accepting it is one change in that
 * document, and one Yjs undo takes it back.
 */

// The editor is its own lazy chunk. Loaded here, before any test, its import never races the
// queries below: under a full parallel run it could take longer than findByRole waits.
beforeAll(() => preloadDocEditor());

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const me = collabUser({ id: 'u-rohan', name: 'Rohan S.', email: 'rohan@acme.test' });
const LINE = 'Sessions move to Postgres';

function session(doc: Doc): CollabSession {
  return {
    doc,
    provider: null,
    getState: () => ({ status: 'local' }) as never,
    subscribe: () => () => undefined,
    destroy: () => undefined,
  };
}

/** The shared document as text: what every collaborator receives. */
const shared = (doc: Doc) => doc.getXmlFragment('default').toString();

async function setup(ai: AiHandler) {
  const doc = new Doc();
  seedLocal(doc, {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: LINE }] }],
  });
  render(
    <DocEditor
      label="Page body"
      extensions={collabExtensions(session(doc), me)}
      services={{ ai }}
    />,
  );
  const box = await screen.findByRole('textbox', { name: 'Page body' });
  const editor = (box as HTMLElement & { editor: Editor }).editor;
  await waitFor(() => expect(editor.getText()).toBe(LINE));
  return { doc, box, editor };
}

async function* once(text: string): AsyncIterable<AiWriteEvent> {
  yield { type: 'text', text };
  yield { type: 'done', runId: null };
}

describe('AI on a shared page', () => {
  it('keeps ghost text out of the shared document until Tab, then one undo removes it', async () => {
    const { doc, box, editor } = await setup({ complete: async () => ' behind a flag.' });
    vi.useFakeTimers();
    act(() => {
      editor.chain().focus('end').insertContent(' now').run();
    });
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(document.querySelector('[data-ghost-text]')).not.toBeNull();
    expect(shared(doc)).not.toContain('behind a flag');
    vi.useRealTimers();

    fireEvent.keyDown(box, { key: 'Tab' });
    await waitFor(() => expect(shared(doc)).toContain(`${LINE} now behind a flag.`));
    act(() => {
      editor.commands.undo();
    });
    await waitFor(() => expect(shared(doc)).toContain(`${LINE} now<`));
    expect(shared(doc)).not.toContain('behind a flag');
  });

  it('streams a suggestion beside the text, not into it, and applies it as one change', async () => {
    const write = vi.fn(() => once('We move sessions to Postgres.'));
    const { doc, editor } = await setup({ write });
    act(() => {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: 1, to: 1 + LINE.length })
        .run();
    });
    fireEvent.click(await screen.findByRole('button', { name: /Ask AI/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Improve writing' }));
    await screen.findByRole('button', { name: 'Replace' });
    expect(shared(doc)).not.toContain('We move sessions');

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(shared(doc)).toContain('We move sessions to Postgres.'));
    expect(shared(doc)).not.toContain(LINE);
    act(() => {
      editor.commands.undo();
    });
    await waitFor(() => expect(shared(doc)).toContain(LINE));
    expect(shared(doc)).not.toContain('We move sessions');
  });
});
