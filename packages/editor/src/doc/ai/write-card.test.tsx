import type { Editor } from '@tiptap/core';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RichTextDoc } from '../../types.ts';
import DocEditor from '../doc-editor.tsx';
import type { AiHandler } from '../services.ts';
import { runAiCommand } from './run-command.ts';
import type { AiCommand, AiWriteEvent } from './types.ts';

afterEach(cleanup);

const DOC: RichTextDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rollout' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'we moves sessions to postgres' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Redis stays warm.' }] },
  ],
};
const IMPROVE: AiCommand = { id: 'improve', label: 'Improve writing', kind: 'transform' };
const CONTINUE: AiCommand = { id: 'continue', label: 'Continue writing', kind: 'generate' };

/** A write the test lets out a piece at a time. */
function scripted() {
  const pieces: Array<(event: AiWriteEvent | null) => void> = [];
  const waiting: Array<AiWriteEvent | null> = [];
  const next = () =>
    new Promise<AiWriteEvent | null>((resolve) => {
      const ready = waiting.shift();
      if (ready !== undefined) resolve(ready);
      else pieces.push(resolve);
    });
  const send = (event: AiWriteEvent | null) => {
    const resolve = pieces.shift();
    if (resolve) resolve(event);
    else waiting.push(event);
  };
  async function* write(): AsyncIterable<AiWriteEvent> {
    for (let event = await next(); event; event = await next()) yield event;
  }
  return { write: vi.fn(write), send };
}

async function setup(ai: AiHandler) {
  render(<DocEditor label="Page body" initialDoc={DOC} services={{ ai }} />);
  const box = await screen.findByRole('textbox', { name: 'Page body' });
  return (box as HTMLElement & { editor: Editor }).editor;
}

/** The caret in the second paragraph. */
const caretInLine = (editor: Editor) =>
  act(() => {
    editor.chain().focus().setTextSelection(15).run();
  });

const card = () => screen.queryByRole('region', { name: /AI/ });
const text = (editor: Editor) => editor.getText({ blockSeparator: '\n' });

describe('the suggestion card', () => {
  it('streams into the card and never into the page until a person applies it', async () => {
    const stream = scripted();
    const editor = await setup({ write: stream.write });
    caretInLine(editor);
    act(() => runAiCommand(editor, IMPROVE, { write: stream.write }));
    expect(await screen.findByText('Writing…')).toBeTruthy();
    expect(stream.write).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: 'improve',
        targetText: 'we moves sessions to postgres',
        heading: 'Rollout',
      }),
      expect.any(AbortSignal),
    );
    await act(async () => stream.send({ type: 'text', text: 'We move sessions ' }));
    await act(async () => stream.send({ type: 'text', text: 'to Postgres.' }));
    await waitFor(() => expect(card()?.textContent).toContain('We move sessions to Postgres.'));
    expect(JSON.stringify(editor.getJSON())).not.toContain('We move sessions');
    await act(async () => stream.send(null));
    expect(await screen.findByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ask again' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not useful' })).toBeTruthy();
  });

  it('replaces the line in one change that one undo takes back', async () => {
    const stream = scripted();
    const ai = { write: stream.write };
    const editor = await setup(ai);
    caretInLine(editor);
    act(() => runAiCommand(editor, IMPROVE, ai));
    await act(async () => {
      stream.send({ type: 'text', text: 'We move sessions to Postgres.' });
      stream.send(null);
    });
    const before = text(editor);
    fireEvent.click(await screen.findByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(card()).toBeNull());
    expect(text(editor)).toBe('Rollout\nWe move sessions to Postgres.\nRedis stays warm.');
    act(() => {
      editor.commands.undo();
    });
    expect(text(editor)).toBe(before);
  });

  it('inserts what it wrote after the block, and Discard leaves the page alone', async () => {
    const stream = scripted();
    const ai = { write: stream.write };
    const editor = await setup(ai);
    caretInLine(editor);
    act(() => runAiCommand(editor, CONTINUE, ai));
    await act(async () => {
      stream.send({ type: 'text', text: 'Reads cut over next.' });
      stream.send(null);
    });
    expect(screen.queryByRole('button', { name: 'Replace' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Insert' }));
    await waitFor(() => expect(card()).toBeNull());
    expect(text(editor)).toBe(
      'Rollout\nwe moves sessions to postgres\nReads cut over next.\nRedis stays warm.',
    );

    const again = scripted();
    act(() => runAiCommand(editor, CONTINUE, { write: again.write }));
    await act(async () => {
      again.send({ type: 'text', text: 'Not this.' });
      again.send(null);
    });
    const kept = text(editor);
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
    expect(card()).toBeNull();
    expect(text(editor)).toBe(kept);
  });

  it('replaces only the words chosen when Ask AI ran over a selection', async () => {
    const stream = scripted();
    const ai = { write: stream.write };
    const editor = await setup(ai);
    act(() => {
      editor.chain().focus().setTextSelection({ from: 13, to: 18 }).run();
    });
    act(() => runAiCommand(editor, IMPROVE, ai));
    expect(stream.write).toHaveBeenCalledWith(
      expect.objectContaining({ targetText: 'moves' }),
      expect.any(AbortSignal),
    );
    await act(async () => {
      stream.send({ type: 'text', text: 'move' });
      stream.send(null);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(text(editor)).toContain('we move sessions to postgres'));
  });

  it('says a failure plainly inside the card and tries again', async () => {
    const write = vi.fn(async function* (): AsyncIterable<AiWriteEvent> {
      yield* [];
      throw new Error('rate limited');
    });
    const ai: AiHandler = { write, describeError: () => 'The provider is rate limiting.' };
    const editor = await setup(ai);
    caretInLine(editor);
    act(() => runAiCommand(editor, IMPROVE, ai));
    expect(await screen.findByText('The provider is rate limiting.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
    expect(text(editor)).toContain('we moves sessions to postgres');
  });

  it('closes on Esc from the text', async () => {
    const stream = scripted();
    const editor = await setup({ write: stream.write });
    caretInLine(editor);
    act(() => runAiCommand(editor, IMPROVE, { write: stream.write }));
    expect(await screen.findByText('Writing…')).toBeTruthy();
    fireEvent.keyDown(editor.view.dom, { key: 'Escape' });
    expect(card()).toBeNull();
  });
});
