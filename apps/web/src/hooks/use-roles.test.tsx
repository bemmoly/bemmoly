import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ROLE_IDS } from '../mocks/seed/people.ts';
import { RolesPage } from '../pages/settings/roles-page.tsx';
import { renderPage } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';

const EDITABLE = [ROLE_IDS.projectAdmin, ROLE_IDS.member, ROLE_IDS.viewer, ROLE_IDS.contractor];

describe('Roles and permissions page', () => {
  it('locks a row and changes a cell, then saves only the changed roles', async () => {
    await renderPage(() => <RolesPage />);
    const lock = await screen.findByRole('switch', {
      name: 'Lock Create and edit issues at org level',
    });
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveProperty('disabled', true);
    expect(lock.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(lock);
    fireEvent.click(screen.getByRole('checkbox', { name: 'View issues: Viewer' }));
    expect(lock.getAttribute('aria-checked')).toBe('true');
    expect(save).toHaveProperty('disabled', false);

    const admin = screen.getByRole('checkbox', { name: 'View issues: Org admin' });
    expect(admin).toHaveProperty('disabled', true);
    fireEvent.click(admin);
    expect(admin).toHaveProperty('checked', true);

    fireEvent.click(save);
    await waitFor(() =>
      expect(mockApi.db.cells['work.issue.view']?.[ROLE_IDS.viewer]?.allowed).toBe(false),
    );
    const edit = mockApi.db.cells['work.issue.edit'] ?? {};
    for (const roleId of EDITABLE) expect(edit[roleId]?.lockedByOrg).toBe(true);
    expect(edit[ROLE_IDS.admin]?.lockedByOrg).toBe(false);
    expect(edit[ROLE_IDS.member]?.allowed).toBe(true);
    await waitFor(() => expect(save).toHaveProperty('disabled', true));
  });

  it('shows custom roles under their name and creates one from a copy', async () => {
    await renderPage(() => <RolesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Create custom role' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Auditor' } });
    fireEvent.change(screen.getByLabelText('Start from'), { target: { value: ROLE_IDS.viewer } });
    fireEvent.click(screen.getByRole('button', { name: 'Create role' }));
    await screen.findByRole('columnheader', { name: 'Auditor custom' });
    const auditor = mockApi.db.roles.find((role) => role.name === 'Auditor');
    expect(auditor?.isSystem).toBe(false);
    expect(mockApi.db.cells['work.issue.view']?.[auditor?.id ?? '']?.allowed).toBe(true);
  });
});
