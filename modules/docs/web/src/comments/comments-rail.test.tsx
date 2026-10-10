import { queryKeys } from '@bemmoly/api-client';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { id, listed, newClient, providers, startServer } from '../test-support.tsx';
import { useCommentUi } from './comment-store.ts';
import { CommentsRail, sortThreads } from './comments-rail.tsx';
import { threadsOf } from './use-comments.ts';

const PAGE = id(500);
const ME = { id: id(501), name: 'Rohan Sharma' };
const JONAS = { id: id(502), name: 'Jonas M.' };
const at = (day: number) => `2026-10-0${day}T10:00:00.000Z`;
const doc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function comment(text: string, overrides: Record<string, unknown> = {}) {
  return {
    id: id(),
    pageId: PAGE,
    parentId: null,
    author: JONAS,
    body: doc(text),
    bodyText: text,
    anchor: null,
    anchorStatus: null,
    aiSuggestion: null,
    resolvedAt: null,
    resolvedBy: null,
    editedAt: null,
    createdAt: at(1),
    ...overrides,
  };
}

const anchor = (quote: string) => ({ from: 'AQID', to: 'BAUG', quote });
const FIFTEEN = comment('Rollback says 15 min but the flag TTL in code is 30. Which is it?', {
  anchor: anchor('stay valid for 15 minutes'),
  anchorStatus: 'anchored',
  aiSuggestion: { replacement: '30 minutes', rationale: 'Code says 30.' },
});
const REPLY = comment('Good catch, fixing.', {
  parentId: FIFTEEN.id,
  author: ME,
  createdAt: at(2),
});
const COOKIE = comment('This needs an issue; nobody owns it.', {
  anchor: anchor('Remove the legacy cookie path'),
  anchorStatus: 'text_changed',
  author: ME,
  createdAt: at(3),
});
const GENERAL = comment('Looks good overall.', { createdAt: at(4) });
const OPEN = [FIFTEEN, REPLY, COOKIE, GENERAL];
const RESOLVED = comment('Done on staging, backfill verified.', { resolvedAt: at(5) });

const { server, calls } = startServer(
  http.get('*/api/v1/docs/pages/:pageId/comments', ({ request }) =>
    HttpResponse.json(
      listed(new URL(request.url).searchParams.get('resolved') === 'true' ? [RESOLVED] : OPEN),
    ),
  ),
);

afterEach(() => useCommentUi.getState().reset(PAGE));

function renderRail(canComment = true) {
  const client = newClient();
  client.setQueryData(queryKeys.me(), { user: ME, capabilities: [], modules: [], workspace: {} });
  render(<CommentsRail pageId={PAGE} canComment={canComment} />, { wrapper: providers(client) });
  return client;
}

const card = (text: string) => screen.getByText(text).closest('article')!;

describe('the comments rail', () => {
  it('shows threads with their quote, replies and a text-changed marker', async () => {
    renderRail();
    expect(await screen.findByText(/Which is it\?/)).toBeTruthy();
    const fifteen = card('stay valid for 15 minutes');
    expect(within(fifteen).getByText('Good catch, fixing.')).toBeTruthy();
    expect(within(fifteen).queryByText('Text changed')).toBeNull();
    expect(within(card('Remove the legacy cookie path')).getByText('Text changed')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Open (3)' })).toBeTruthy();
  });

  it('offers Apply fix only on a thread that carries a suggestion', async () => {
    renderRail();
    await screen.findByText(/Which is it\?/);
    expect(
      within(card('stay valid for 15 minutes')).getByRole('button', { name: 'Apply fix' }),
    ).toBeTruthy();
    expect(
      within(card('Looks good overall.')).queryByRole('button', { name: 'Apply fix' }),
    ).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Apply fix' })).toHaveLength(1);
  });

  it('resolves a thread and says when a fix went stale', async () => {
    server.use(
      http.post('*/api/v1/docs/comments/:id/resolve', () =>
        HttpResponse.json({ ...GENERAL, resolvedAt: at(6) }),
      ),
      http.post('*/api/v1/docs/comments/:id/apply-suggestion', () =>
        HttpResponse.json({ code: 'conflict', message: 'stale', requestId: 't' }, { status: 409 }),
      ),
    );
    renderRail();
    await screen.findByText(/Which is it\?/);
    fireEvent.click(within(card('Looks good overall.')).getByRole('button', { name: 'Resolve' }));
    await waitFor(() =>
      expect(calls.map((call) => call.path)).toContain(
        `/api/v1/docs/comments/${GENERAL.id}/resolve`,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply fix' }));
    expect(await screen.findByText('The text changed since this fix was suggested')).toBeTruthy();
  });

  it('lets only the author edit and delete, and asks before deleting a thread', async () => {
    server.use(
      http.delete('*/api/v1/docs/comments/:id', () => new HttpResponse(null, { status: 204 })),
    );
    renderRail();
    await screen.findByText(/Which is it\?/);
    expect(
      within(card('Looks good overall.')).queryByRole('button', { name: 'Comment actions' }),
    ).toBeNull();
    const cookie = card('Remove the legacy cookie path');
    fireEvent.click(within(cookie).getByRole('button', { name: 'Comment actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    expect(await screen.findByText('It is deleted for everyone on the page.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'DELETE',
        path: `/api/v1/docs/comments/${COOKIE.id}`,
        body: undefined,
      }),
    );
  });

  it('replies in the thread with a rich text body', async () => {
    server.use(
      http.post('*/api/v1/docs/pages/:pageId/comments', async ({ request }) =>
        HttpResponse.json(
          { ...REPLY, id: id(), ...((await request.json()) as object) },
          { status: 201 },
        ),
      ),
    );
    renderRail();
    await screen.findByText(/Which is it\?/);
    fireEvent.click(within(card('Looks good overall.')).getByRole('button', { name: 'Reply' }));
    const box = await screen.findByRole('textbox', { name: 'Reply' }, { timeout: 5000 });
    const editor = (
      box as HTMLElement & { editor: { commands: { setContent(doc: unknown): void } } }
    ).editor;
    act(() => editor.commands.setContent(doc('Agreed.')));
    fireEvent.click(within(card('Looks good overall.')).getByRole('button', { name: 'Reply' }));
    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({
        method: 'POST',
        path: `/api/v1/docs/pages/${PAGE}/comments`,
        body: { parentId: GENERAL.id, body: doc('Agreed.') },
      }),
    );
  });

  it('switches to resolved threads and offers Reopen', async () => {
    renderRail();
    await screen.findByText(/Which is it\?/);
    fireEvent.click(screen.getByRole('radio', { name: 'Resolved' }));
    expect(await screen.findByText('Done on staging, backfill verified.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy();
  });

  it('hides every write from someone who may only read', async () => {
    renderRail(false);
    await screen.findByText(/Which is it\?/);
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apply fix' })).toBeNull();
  });

  it('opens a draft for a selection with its quote', async () => {
    renderRail();
    await screen.findByText(/Which is it\?/);
    act(() => useCommentUi.getState().startDraft(PAGE, anchor('flag flip')));
    const draft = await screen.findByRole('region', { name: 'New comment' });
    expect(within(draft).getByText('flag flip')).toBeTruthy();
  });

  it('shows an empty state and a failure with a retry', async () => {
    server.use(
      http.get('*/api/v1/docs/pages/:pageId/comments', () => HttpResponse.json(listed([]))),
    );
    renderRail();
    expect(await screen.findByText('No open comments')).toBeTruthy();
    server.use(
      http.get('*/api/v1/docs/pages/:pageId/comments', () =>
        HttpResponse.json({ code: 'internal', message: 'down', requestId: 't' }, { status: 500 }),
      ),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Resolved' }));
    expect(await screen.findByText('Comments could not be loaded')).toBeTruthy();
  });
});

describe('thread order', () => {
  it('puts inline threads in page order, then the rest oldest first', () => {
    const threads = threadsOf(OPEN as never);
    const sorted = sortThreads(threads, [COOKIE.id, FIFTEEN.id]);
    expect(sorted.map((thread) => thread.root.id)).toEqual([COOKIE.id, FIFTEEN.id, GENERAL.id]);
    expect(threads.find((thread) => thread.root.id === FIFTEEN.id)?.replies).toHaveLength(1);
  });
});
