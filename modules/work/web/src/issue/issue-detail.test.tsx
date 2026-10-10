import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { IssueSlideOver } from './issue-slide-over.tsx';
import { StatusMenu } from './status-menu.tsx';
import { issue, IDS, me, Providers, startServer } from './test-support.tsx';

const server = startServer();

const transitions = [
  {
    id: IDS.testing,
    name: 'Approve',
    toStatusId: IDS.testing,
    toStatusName: 'Testing',
    toStatusCategory: 'in_progress',
    available: true,
    blockedBy: [],
  },
  {
    id: IDS.epic,
    name: 'Merge',
    toStatusId: IDS.epic,
    toStatusName: 'Done',
    toStatusCategory: 'done',
    available: false,
    blockedBy: ['A pull request must be linked'],
  },
];

describe('IssueSlideOver', () => {
  it('shows the issue with its properties, sections and All activity, and no AI while AI is off', async () => {
    render(
      <Providers>
        <IssueSlideOver issueKey="PLT-204" onClose={() => undefined} />
      </Providers>,
    );
    expect(await screen.findByText('Session store migration to Postgres')).toBeTruthy();
    expect(screen.getByText('Move sessions.')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'PLT-204 details' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Assignee' }).textContent).toContain('Aisha K.');
    expect(screen.getByRole('region', { name: 'Planning' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Fix version' }).textContent).toContain(
      'Add version',
    );
    expect(await screen.findByRole('button', { name: 'Assign to me' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Sub-issues' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Links' })).toBeTruthy();
    expect(screen.getByText(/Show what blocks this/)).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByRole('region', { name: /AI summary/ })).toBeNull();
  });

  it('shows the AI summary in lilac only when the workspace has AI on', async () => {
    server.use(http.get('*/api/v1/me', () => HttpResponse.json(me(true))));
    render(
      <Providers>
        <IssueSlideOver issueKey="PLT-204" onClose={() => undefined} />
      </Providers>,
    );
    const summary = await screen.findByRole('region', { name: 'AI summary' });
    expect(summary.className).toContain('bg-ai-bg');
  });

  it('assigns the issue to the viewer at once and rolls back when the server refuses', async () => {
    server.use(
      http.get('*/api/v1/me', () => HttpResponse.json(me(false))),
      http.patch('*/api/v1/work/issues/PLT-204', async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return HttpResponse.json(
          { code: 'forbidden', message: 'You cannot assign here', requestId: 't' },
          { status: 403 },
        );
      }),
    );
    render(
      <Providers>
        <IssueSlideOver issueKey="PLT-204" onClose={() => undefined} />
      </Providers>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Assign to me' }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Assignee' }).textContent).toContain('Rohan S.'),
    );
    expect(await screen.findByText('The assignee was not saved')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Assignee' }).textContent).toContain('Aisha K.'),
    );
  });

  it('renders nothing without an issue key', () => {
    render(
      <Providers>
        <IssueSlideOver issueKey={null} onClose={() => undefined} />
      </Providers>,
    );
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

describe('StatusMenu', () => {
  it('lists the transitions, keeps blocked ones disabled and moves the issue at once', async () => {
    let patched: unknown = null;
    server.use(
      http.get('*/api/v1/work/issues/PLT-204/transitions', () =>
        HttpResponse.json({ items: transitions }),
      ),
      http.patch('*/api/v1/work/issues/PLT-204', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...issue, statusId: IDS.testing });
      }),
    );
    render(
      <Providers>
        <StatusMenu issue={issue as never} />
      </Providers>,
    );
    act(() => screen.getByRole('button', { name: /Change status/ }).click());
    const approve = await screen.findByRole('menuitem', { name: /Approve/ });
    const merge = screen.getByRole('menuitem', { name: /Merge/ });
    expect(merge.getAttribute('aria-disabled')).toBe('true');
    expect(merge.textContent).toContain('A pull request must be linked');
    fireEvent.click(approve);
    await waitFor(() => expect(patched).toEqual({ statusId: IDS.testing }));
  });

  it('offers the next available transitions as one-click buttons', async () => {
    let patched: unknown = null;
    server.use(
      http.get('*/api/v1/work/issues/PLT-204/transitions', () =>
        HttpResponse.json({ items: transitions }),
      ),
      http.patch('*/api/v1/work/issues/PLT-204', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...issue, statusId: IDS.testing });
      }),
    );
    render(
      <Providers>
        <StatusMenu issue={issue as never} />
      </Providers>,
    );
    const quick = await screen.findByRole('group', { name: 'Move to' });
    expect(within(quick).queryByRole('button', { name: /Done/ })).toBeNull();
    fireEvent.click(within(quick).getByRole('button', { name: /Testing/ }));
    await waitFor(() => expect(patched).toEqual({ statusId: IDS.testing }));
  });

  it('offers Undo after a status change and moves the issue back', async () => {
    const patches: unknown[] = [];
    server.use(
      http.get('*/api/v1/work/issues/PLT-204/transitions', () =>
        HttpResponse.json({ items: transitions }),
      ),
      http.patch('*/api/v1/work/issues/PLT-204', async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json(issue);
      }),
    );
    render(
      <Providers>
        <StatusMenu issue={issue as never} />
      </Providers>,
    );
    const quick = await screen.findByRole('group', { name: 'Move to' });
    fireEvent.click(within(quick).getByRole('button', { name: /Testing/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(patches).toEqual([{ statusId: IDS.testing }, { statusId: issue.statusId }]),
    );
  });
});
