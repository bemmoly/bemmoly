import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { suggestKey } from '../hooks/projects-list.ts';
import { project, Providers, startServer } from '../issue/test-support.tsx';
import { CreateProjectDialog } from './create-project-dialog.tsx';

const server = startServer();

describe('suggestKey', () => {
  it('takes initials of several words and the start of one', () => {
    expect(suggestKey('Platform Core')).toBe('PC');
    expect(suggestKey('Mobile')).toBe('MOB');
    expect(suggestKey('2026 roadmap')).toBe('R');
  });
});

describe('CreateProjectDialog', () => {
  const open = (onCreated = vi.fn()) =>
    render(
      <Providers>
        <CreateProjectDialog open onClose={() => undefined} onCreated={onCreated} />
      </Providers>,
    );

  it('suggests the key from the name and creates a Kanban project', async () => {
    let body: unknown = null;
    server.use(
      http.post('*/api/v1/work/projects', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...project, key: 'DP', name: 'Data Platform' }, { status: 201 });
      }),
    );
    const onCreated = vi.fn();
    open(onCreated);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Data Platform' } });
    expect((screen.getByLabelText('Key') as HTMLInputElement).value).toBe('DP');
    fireEvent.click(screen.getByRole('radio', { name: /Kanban/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(body).toEqual({ key: 'DP', name: 'Data Platform', method: 'kanban' });
  });

  it('checks the key and shows a taken key under the field', async () => {
    server.use(
      http.post('*/api/v1/work/projects', () =>
        HttpResponse.json(
          { code: 'conflict', message: 'A project with the key PLT exists', requestId: 'test' },
          { status: 409 },
        ),
      ),
    );
    open();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Platform' } });
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'p' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText(/2 to 10 capital letters/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'plt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Another project already uses this key.')).toBeTruthy();
  });
});
