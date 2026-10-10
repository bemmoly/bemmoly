import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { mentionedUserIds, richTextToPlain, type RichText } from '../../../shared/index.ts';
import { CommentBox } from './comment-box.tsx';
import { IssueSlideOver } from './issue-slide-over.tsx';
import { RichTextSection } from './rich-text-section.tsx';
import { IDS, Providers, startServer } from './test-support.tsx';

const server = startServer();

/** The part of the editor instance these tests drive; Tiptap puts it on the text box. */
interface EditorHandle {
  commands: {
    setContent(content: RichText): boolean;
    clearContent(emitUpdate?: boolean): boolean;
    insertContent(content: string): boolean;
    focus(position?: 'end'): boolean;
  };
  getJSON(): RichText;
}

/** The editor behind a named text box, once its lazy chunk has loaded. */
async function editorNamed(name: string) {
  const box = await screen.findByRole('textbox', { name }, { timeout: 5000 });
  return { box, editor: (box as HTMLElement & { editor: EditorHandle }).editor };
}

/** Writes at the caret; the suggestion lists open from what the document holds. */
const type = (editor: EditorHandle, text: string) =>
  act(() => {
    editor.commands.insertContent(text);
  });

const written: RichText = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rollout' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Ask ' },
        { type: 'mention', attrs: { id: IDS.aisha, label: 'Aisha K.' } },
        { type: 'text', text: ' about ' },
        {
          type: 'text',
          text: 'PLT-218',
          marks: [{ type: 'link', attrs: { href: '/work/issue/PLT-218' } }],
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Backfill' }] }],
        },
      ],
    },
    { type: 'codeBlock', content: [{ type: 'text', text: 'SELECT 1;' }] },
  ],
};

describe('RichTextSection', () => {
  it('saves what the editor holds, so the server derives the right plain-text shadow', async () => {
    const onSave = vi.fn<(doc: RichText | null) => Promise<unknown>>(async () => undefined);
    render(
      <Providers>
        <RichTextSection title="Description" size="page" doc={null} onSave={onSave} />
      </Providers>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Describe the problem/ }));
    const { editor } = await editorNamed('Description');
    act(() => {
      editor.commands.setContent(written);
    });
    // Nothing to press: it saves itself once typing pauses, and says so.
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce(), { timeout: 3000 });
    expect(await screen.findByText('Saved')).toBeTruthy();
    const saved = onSave.mock.calls[0]![0]!;
    expect(saved).toEqual(editor.getJSON());
    expect(richTextToPlain(saved)).toBe(
      'Rollout\nAsk @Aisha K. about PLT-218\nBackfill\nSELECT 1;',
    );
    expect(mentionedUserIds(saved)).toEqual([IDS.aisha]);
  });

  it('clears the field when everything is deleted', async () => {
    const onSave = vi.fn<(doc: RichText | null) => Promise<unknown>>(async () => undefined);
    render(
      <Providers>
        <RichTextSection title="Description" size="page" doc={written} onSave={onSave} />
      </Providers>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit description' }));
    const { editor } = await editorNamed('Description');
    act(() => {
      editor.commands.clearContent(true);
    });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null), { timeout: 3000 });
  });

  it('keeps the draft and offers Retry when the save fails', async () => {
    let fail = true;
    const onSave = vi.fn<(doc: RichText | null) => Promise<unknown>>(async () => {
      if (fail) throw new Error('offline');
    });
    render(
      <Providers>
        <RichTextSection title="Description" size="page" doc={written} onSave={onSave} />
      </Providers>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit description' }));
    const { editor } = await editorNamed('Description');
    act(() => {
      editor.commands.clearContent(true);
    });
    expect(await screen.findByText('Not saved', {}, { timeout: 3000 })).toBeTruthy();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Saved')).toBeTruthy());
    expect(onSave).toHaveBeenLastCalledWith(null);
  });
});

describe('CommentBox', () => {
  it('mentions a person found by the people search and posts the document', async () => {
    const onSubmit = vi.fn<(body: RichText) => Promise<unknown>>(async () => undefined);
    render(
      <Providers>
        <CommentBox viewer={{ id: IDS.rohan, name: 'Rohan S.', email: '' }} onSubmit={onSubmit} />
      </Providers>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Leave a comment/ }));
    const { editor } = await editorNamed('Comment');
    type(editor, 'cc @Ais');
    fireEvent.click(await screen.findByRole('option', { name: /Aisha K\./ }));
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const body = onSubmit.mock.calls[0]![0];
    expect(mentionedUserIds(body)).toEqual([IDS.aisha]);
    expect(richTextToPlain(body)).toBe('cc @Aisha K.');
  });
});

describe('IssueSlideOver', () => {
  it.each(['docked', 'overlay'] as const)(
    'edits the description in the %s drawer, # list included',
    async (variant) => {
      server.use(
        http.get('*/api/v1/work/search/suggest', () =>
          HttpResponse.json({
            items: [
              {
                id: IDS.issue,
                key: 'PLT-218',
                projectId: IDS.project,
                title: 'Rotate service tokens',
                statusId: IDS.review,
                typeId: IDS.story,
              },
            ],
            nextCursor: null,
          }),
        ),
      );
      render(
        <Providers>
          <IssueSlideOver issueKey="PLT-204" variant={variant} onClose={() => undefined} />
        </Providers>,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Edit description' }));
      const { box, editor } = await editorNamed('Description');
      expect(box.closest(variant === 'overlay' ? 'dialog' : 'aside')).not.toBeNull();
      act(() => {
        editor.commands.focus('end');
      });
      type(editor, ' #PLT');
      const option = await screen.findByRole('option', { name: /PLT-218/ });
      /* A modal dialog makes the page outside it inert, so the list must live inside it. */
      expect(option.closest('dialog')).toBe(box.closest('dialog'));
    },
  );
});
