import type { Editor } from '@tiptap/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { issue, IDS, Providers, startServer } from '../issue/test-support.tsx';
import { CreateIssueDialog } from './create-issue-dialog.tsx';

const server = startServer();

/** Types into a rich text section through its editor, as a person would. */
async function write(name: RegExp, text: string) {
  const box = await screen.findByRole('textbox', { name });
  const editor = (box as HTMLElement & { editor: Editor }).editor;
  act(() => {
    editor.chain().focus('end').insertContent(text).run();
  });
}

const open = (onCreated = vi.fn()) =>
  render(
    <Providers>
      <CreateIssueDialog open projectKey="PLT" onClose={() => undefined} onCreated={onCreated} />
    </Providers>,
  );

describe('CreateIssueDialog', () => {
  it("lays the form out from the type's layout and checks its required fields", async () => {
    open();
    expect(await screen.findByRole('region', { name: 'Acceptance criteria' })).toBeTruthy();
    expect(screen.queryByLabelText('Severity')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /More fields/ }));
    expect(screen.getByLabelText('Severity')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Issue type' }).textContent).toContain('Story');
    fireEvent.click(screen.getByRole('button', { name: /^Create issue/ }));
    expect(await screen.findByText('Give the issue a title.')).toBeTruthy();
    expect(screen.getByText('Acceptance criteria is required.')).toBeTruthy();
  });

  it('creates the issue with its custom fields and names the new key', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post('*/api/v1/work/issues', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...issue, number: 227, key: 'PLT-227' }, { status: 201 });
      }),
    );
    const onCreated = vi.fn();
    open(onCreated);
    const title = await screen.findByLabelText(/Title/);
    fireEvent.change(title, { target: { value: 'Session audit export' } });
    await write(/Acceptance criteria/, 'Covers 90 days');
    fireEvent.click(screen.getByRole('button', { name: /^Create issue/ }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(body).toMatchObject({
      projectId: IDS.project,
      typeId: IDS.story,
      title: 'Session audit export',
      customFields: {
        acceptance_criteria: {
          type: 'doc',
          content: [{ type: 'taskList' }],
        },
      },
    });
    expect(await screen.findByText('Created PLT-227')).toBeTruthy();
  });

  it('puts a server field error under its field', async () => {
    server.use(
      http.post('*/api/v1/work/issues', () =>
        HttpResponse.json(
          {
            code: 'validation_failed',
            message: 'The request is not valid',
            requestId: 'test',
            details: {
              issues: [{ path: 'title', code: 'custom', message: 'Too similar to PLT-204.' }],
            },
          },
          { status: 400 },
        ),
      ),
    );
    open();
    fireEvent.change(await screen.findByLabelText(/Title/), { target: { value: 'Sessions' } });
    await write(/Acceptance criteria/, 'Done');
    fireEvent.click(screen.getByRole('button', { name: /^Create issue/ }));
    expect(await screen.findByText('Too similar to PLT-204.')).toBeTruthy();
  });
});
