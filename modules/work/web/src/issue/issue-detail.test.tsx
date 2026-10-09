import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { IssueSlideOver } from './issue-slide-over.tsx';
import { StatusMenu } from './status-menu.tsx';
import { issue, IDS, Providers, startServer } from './test-support.tsx';

const server = startServer();

describe('IssueSlideOver', () => {
  it('shows the issue with its details, AI empty state and activity', async () => {
    render(
      <Providers>
        <IssueSlideOver issueKey="PLT-204" onClose={() => undefined} />
      </Providers>,
    );
    expect(await screen.findByText('Session store migration to Postgres')).toBeTruthy();
    expect(screen.getByText('Move sessions.')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'PLT-204 details' })).toBeTruthy();
    expect(screen.getByText(/once AI is turned on/)).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Assignee' }).textContent).toContain('Aisha K.');
    expect(screen.getByRole('radiogroup', { name: 'Show in activity' })).toBeTruthy();
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
  it('lists the transitions, keeps blocked ones disabled and moves the issue', async () => {
    let patched: unknown = null;
    server.use(
      http.get('*/api/v1/work/issues/PLT-204/transitions', () =>
        HttpResponse.json({
          items: [
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
          ],
        }),
      ),
      http.patch('*/api/v1/work/issues/PLT-204', async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...issue, statusId: IDS.testing });
      }),
    );
    render(
      <Providers>
        <StatusMenu issue={issue as never} size="xl" />
      </Providers>,
    );
    act(() => screen.getByRole('button', { name: /Change status/ }).click());
    const approve = await screen.findByRole('menuitem', { name: /Approve/ });
    const merge = screen.getByRole('menuitem', { name: /Merge/ });
    expect(merge.getAttribute('aria-disabled')).toBe('true');
    expect(merge.textContent).toContain('A pull request must be linked');
    fireEvent.click(approve);
    await waitFor(() => expect(patched).toEqual({ statusId: IDS.testing }));
    expect(await screen.findByText('PLT-204 moved to Testing')).toBeTruthy();
  });
});
