import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { USER_IDS } from '../mocks/seed/people.ts';
import { AuditLogPage } from '../pages/settings/audit-log-page.tsx';
import { renderPage, renderQueryHook } from '../test/render.tsx';
import { NO_FILTERS, toAuditQuery, useAuditLog } from './use-audit.ts';

describe('audit filters', () => {
  it('leaves out empty filters and covers whole local days', () => {
    expect(toAuditQuery(NO_FILTERS)).toEqual({});
    expect(
      toAuditQuery({
        action: ' backup. ',
        actorId: 'u-1',
        targetKind: 'backup',
        since: '2026-10-01',
        until: '2026-10-02',
      }),
    ).toEqual({
      action: 'backup.',
      actorId: 'u-1',
      targetKind: 'backup',
      since: new Date('2026-10-01T00:00:00').toISOString(),
      until: new Date('2026-10-02T23:59:59.999').toISOString(),
    });
  });
});

describe('audit log', () => {
  it('loads entries and names the actors', async () => {
    const { result } = await renderQueryHook(() => useAuditLog());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.entries).toHaveLength(12);
    const system = result.current.entries.find((entry) => entry.actorKind === 'system');
    const token = result.current.entries.find((entry) => entry.actorKind === 'api_token');
    await waitFor(() => expect(result.current.people.length).toBeGreaterThan(0));
    expect(system && result.current.actorOf(system)).toBe('System');
    expect(token && result.current.actorOf(token)).toMatch(/^API token · /);
    expect(result.current.targetKinds).toContain('backup');
  });

  it('sends the filters to the server and builds the CSV link from them', async () => {
    const { result } = await renderQueryHook(() => useAuditLog());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.setFilter({ actorId: USER_IDS.rohan, targetKind: 'setting' }));
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.entries[0]?.action).toBe('setting.updated');
    act(() => result.current.setFilter({ action: 'setting.' }));
    await waitFor(() => expect(result.current.exportUrl).toContain('action=setting.'));
    const url = new URL(result.current.exportUrl, 'http://bemmoly.test');
    expect(url.pathname).toBe('/api/v1/audit-log');
    expect(url.searchParams.get('format')).toBe('csv');
    expect(url.searchParams.get('actorId')).toBe(USER_IDS.rohan);
    expect(url.searchParams.get('targetKind')).toBe('setting');
    expect(url.searchParams.has('limit')).toBe(false);
    expect(url.searchParams.has('cursor')).toBe(false);
  });

  it('renders the table and the Export CSV link', async () => {
    await renderPage(() => <AuditLogPage />);
    expect(await screen.findByText('role.capabilities_updated')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Export CSV' });
    expect(link.getAttribute('href')).toBe('/api/v1/audit-log?format=csv');
  });

  it('narrows by action prefix after typing stops, and clears', async () => {
    const { result } = await renderQueryHook(() => useAuditLog());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.setFilter({ action: 'backup.' }));
    await waitFor(() => expect(result.current.entries).toHaveLength(3));
    expect(result.current.entries.every((entry) => entry.action.startsWith('backup.'))).toBe(true);
    expect(result.current.filtered).toBe(true);
    act(() => result.current.clear());
    await waitFor(() => expect(result.current.entries).toHaveLength(12));
    expect(result.current.filtered).toBe(false);
  });
});
