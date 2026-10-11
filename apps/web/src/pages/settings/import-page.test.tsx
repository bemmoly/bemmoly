import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SECRET_HINT } from '../../components/import/connect-form.tsx';
import { fileTooLarge } from '../../hooks/use-import-flow.ts';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import { ImportPage, NO_SOURCES } from './import-page.tsx';

const click = (element: HTMLElement) => act(() => fireEvent.click(element));
const type = (label: string | RegExp, value: string) =>
  act(() => fireEvent.change(screen.getByLabelText(label), { target: { value } }));

async function connectToJira(token = 'a-token') {
  await renderPage(() => <ImportPage />, '/settings/import');
  click(await screen.findByRole('radio', { name: /Jira/ }));
  type('Site address', 'https://acme.atlassian.net');
  type('Account email', 'rohan@acmelabs.dev');
  type('API token', token);
  click(screen.getByRole('button', { name: 'Connect' }));
}

describe('Settings › Import', () => {
  it('walks a Jira import from connection to report', async () => {
    await connectToJira();
    expect(screen.getByLabelText('API token').getAttribute('type')).toBe('password');
    const found = await screen.findByRole('region', { name: /What to bring in/ });
    expect(within(found).getByText('3 of 3 chosen')).toBeDefined();
    click(within(found).getByRole('checkbox', { name: /Mobile/ }));
    click(within(found).getByRole('button', { name: 'Preview plan' }));

    const plan = await screen.findByRole('region', { name: /Plan/ });
    expect(within(plan).getAllByText('Matched').length).toBeGreaterThan(0);
    expect(within(plan).getAllByText('Reported only').length).toBeGreaterThan(0);
    click(within(plan).getByRole('button', { name: 'Start import' }));

    expect(await screen.findByRole('progressbar', { name: 'Import progress' })).toBeDefined();
    const report = await screen.findByRole(
      'region',
      { name: /Import from Jira/ },
      { timeout: 6000 },
    );
    expect(within(report).getByRole('rowheader', { name: 'Issues' })).toBeDefined();
    expect(within(report).getByText('and 3 more')).toBeDefined();
    expect(within(report).getByRole('button', { name: 'Run again' })).toBeDefined();
    expect(within(report).getByText(/updates what this import made/)).toBeDefined();
  });

  it('says why the connection was refused, beside the form', async () => {
    await connectToJira('wrong');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Jira refused the credentials');
    expect(screen.getByText(SECRET_HINT, { exact: false })).toBeDefined();
  });

  it('cancels a running import and offers Resume', async () => {
    await connectToJira();
    click(await screen.findByRole('button', { name: 'Preview plan' }));
    click(await screen.findByRole('button', { name: 'Start import' }));
    click(await screen.findByRole('button', { name: 'Cancel import' }));
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Recent imports' }).textContent).toContain(
      'Cancelled',
    );
  });

  it('points to Manage modules when no module offers an importer', async () => {
    for (const module of mockApi.db.adminModules) module.enabled = false;
    await renderPage(() => <ImportPage />, '/settings/import');
    expect(await screen.findByText(NO_SOURCES)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Manage modules' })).toBeDefined();
  });

  it('refuses a file over the limit before reading it', () => {
    expect(fileTooLarge(11 * 1024 * 1024)).toMatch(/limit is 10.0 MB/);
    expect(fileTooLarge(1024)).toBeNull();
  });

  it('reads a CSV file and shows the file as the one thing to bring in', async () => {
    await renderPage(() => <ImportPage />, '/settings/import');
    click(await screen.findByRole('radio', { name: /CSV file/ }));
    const input = screen.getByLabelText('CSV file');
    const file = new File(['Summary,Status\nFix login,Todo'], 'issues.csv', { type: 'text/csv' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText('issues.csv is ready to send.')).toBeDefined());
    click(screen.getByRole('button', { name: 'Connect' }));
    const found = await screen.findByRole('region', { name: /What to bring in/ });
    expect(within(found).getByRole('checkbox', { name: /issues\.csv/ })).toBeDefined();
  });
});
