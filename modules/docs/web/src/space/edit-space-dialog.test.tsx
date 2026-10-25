import type { Space } from '@bemmoly/module-docs/shared';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { newClient, providers, space, startServer } from '../test-support.tsx';
import { EditSpaceDialog } from './edit-space-dialog.tsx';

const ENG = space() as Space;

const { calls } = startServer(
  http.patch('*/api/v1/docs/spaces/ENG', async ({ request }) =>
    HttpResponse.json({ ...ENG, ...((await request.json()) as object) }),
  ),
);

function open(onClose = vi.fn()) {
  render(<EditSpaceDialog space={ENG} open onClose={onClose} />, {
    wrapper: providers(newClient()),
  });
  return onClose;
}

describe('edit space', () => {
  it('renames the space, keeping its key, and closes', async () => {
    const onClose = open();
    const name = screen.getByLabelText('Name');
    expect((name as HTMLInputElement).value).toBe('Engineering');
    expect((screen.getByLabelText('Key') as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(name, { target: { value: '  Platform engineering ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(calls).toEqual([
      {
        method: 'PATCH',
        path: '/api/v1/docs/spaces/ENG',
        body: { name: 'Platform engineering', description: null, color: 'accent' },
      },
    ]);
  });

  it('asks for a name instead of saving a blank one', () => {
    const onClose = open();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Give the space a name')).toBeTruthy();
    expect(calls).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });
});
