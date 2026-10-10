import type { Editor } from '@tiptap/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RichTextDoc } from '../../types.ts';
import DocEditor from '../doc-editor.tsx';
import type { AiHandler } from '../services.ts';
import { GHOST_DEBOUNCE_MS, GHOST_TIMEOUT_MS } from './types.ts';

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: false }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const LINE = 'Sessions move to Postgres';
const DOC: RichTextDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: LINE }] }],
};
const GHOST = ' behind a flag.';

async function setup(ai: AiHandler | undefined) {
  render(<DocEditor label="Page body" initialDoc={DOC} services={ai ? { ai } : {}} />);
  await act(() => vi.advanceTimersByTimeAsync(0));
  const box = screen.getByRole('textbox', { name: 'Page body' });
  const editor = (box as HTMLElement & { editor: Editor }).editor;
  act(() => {
    editor.commands.focus('end');
  });
  return { box, editor };
}

/** The person types: a local edit at the caret. */
const type = (editor: Editor, text: string) =>
  act(() => {
    editor.commands.insertContent(text);
  });

const pause = (ms = GHOST_DEBOUNCE_MS) => act(() => vi.advanceTimersByTimeAsync(ms));
const ghost = () => document.querySelector('[data-ghost-text]');
const saved = (editor: Editor) => JSON.stringify(editor.getJSON());

describe('ghost text', () => {
  it('draws the continuation after a pause, without writing it into the document', async () => {
    const complete = vi.fn(async () => GHOST);
    const { editor } = await setup({ complete });
    type(editor, ' now');
    expect(complete).not.toHaveBeenCalled();
    await pause();
    expect(complete).toHaveBeenCalledWith(
      { before: `${LINE} now`, after: '' },
      expect.any(AbortSignal),
    );
    expect(ghost()?.textContent).toBe(`${GHOST}Tab`);
    expect(ghost()?.getAttribute('aria-hidden')).toBe('true');
    expect(editor.getText()).toBe(`${LINE} now`);
    expect(saved(editor)).not.toContain('behind a flag');
  });

  it('writes it in on Tab as one edit that one undo takes back', async () => {
    const { editor, box } = await setup({ complete: async () => GHOST });
    type(editor, ' now');
    await pause();
    fireEvent.keyDown(box, { key: 'Tab' });
    expect(editor.getText()).toBe(`${LINE} now${GHOST}`);
    expect(ghost()).toBeNull();
    act(() => {
      editor.commands.undo();
    });
    expect(editor.getText()).toBe(`${LINE} now`);
  });

  it('drops it on Esc and leaves the document as it was', async () => {
    const { editor, box } = await setup({ complete: async () => GHOST });
    type(editor, ' now');
    await pause();
    const before = saved(editor);
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(ghost()).toBeNull();
    expect(saved(editor)).toBe(before);
  });

  it('drops it when the person keeps typing, and aborts a request still out', async () => {
    let signal: AbortSignal | undefined;
    let answer: (text: string) => void = () => undefined;
    const complete = vi.fn((_: unknown, given: AbortSignal) => {
      signal = given;
      return new Promise<string>((resolve) => (answer = resolve));
    });
    const { editor, box } = await setup({ complete });
    type(editor, ' now');
    await pause();
    fireEvent.keyDown(box, { key: 'a' });
    type(editor, 'a');
    expect(signal?.aborted).toBe(true);
    await act(async () => answer(GHOST));
    expect(ghost()).toBeNull();
  });

  it('drops a request slower than the timeout without a word', async () => {
    let signal: AbortSignal | undefined;
    const complete = vi.fn((_: unknown, given: AbortSignal) => {
      signal = given;
      return new Promise<string>((resolve) => setTimeout(() => resolve(GHOST), 5000));
    });
    const { editor } = await setup({ complete });
    type(editor, ' now');
    await pause();
    await pause(GHOST_TIMEOUT_MS);
    expect(signal?.aborted).toBe(true);
    await pause(5000);
    expect(ghost()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stays quiet when the person turned it off, or without AI', async () => {
    const complete = vi.fn(async () => GHOST);
    const { editor } = await setup({ complete, ghostText: false });
    type(editor, ' now');
    await pause();
    expect(complete).not.toHaveBeenCalled();
    cleanup();
    const bare = await setup(undefined);
    type(bare.editor, ' now');
    await pause();
    expect(ghost()).toBeNull();
  });

  it('asks nothing for another person’s edit', async () => {
    const complete = vi.fn(async () => GHOST);
    const { editor } = await setup({ complete });
    act(() => {
      const { tr } = editor.state;
      editor.view.dispatch(tr.insertText('!', 1).setMeta('y-sync$', { isChangeOrigin: true }));
    });
    await pause();
    expect(complete).not.toHaveBeenCalled();
  });
});
