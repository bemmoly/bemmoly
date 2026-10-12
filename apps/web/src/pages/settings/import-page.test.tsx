import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { REFUSED_TOKEN } from '../../components/import/connect-form.tsx';
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
  type('Site address', 'https://acme.example.net');
  type('Account email', 'rohan@acmelabs.dev');
  type('API token', token);
  click(screen.getByRole('button', { name: 'Connect' }));
}

const continueButton = (n: number) =>
  screen.findByRole('button', { name: `Continue with ${n}` }, { timeout: 3000 });

/** Options: SUP's key is taken by Support Desk, so give it another, then Review. */
async function fixSupAndReview() {
  const key = await screen.findByRole('textbox', { name: 'Key for Support desk' });
  expect(key.getAttribute('aria-invalid')).toBe('true');
  act(() => fireEvent.change(key, { target: { value: 'SUPD' } }));
  const review = screen.getByRole('button', { name: 'Review import' });
  await waitFor(() => expect(review.hasAttribute('disabled')).toBe(false), { timeout: 3000 });
  click(review);
  return screen.findByRole('region', { name: /Review/ });
}

describe('Settings › Import', () => {
  it('walks a Jira import from connection through choosing to report', async () => {
    await connectToJira();
    expect(screen.getByRole('heading', { name: 'Import from Jira' })).toBeDefined();
    const chooser = await screen.findByRole('region', { name: /Choose projects/ });
    expect(chooser.textContent).toContain('acme.example.net · 14 projects this token can see');
    const steps = screen.getByRole('navigation', { name: 'Import steps' });
    expect(within(steps).getByText('Choose').closest('li')?.getAttribute('aria-current')).toBe(
      'step',
    );
    // New projects with issues start ticked: nine of the fourteen.
    await continueButton(9);
    const mobile = within(chooser)
      .getAllByRole('option')
      .find((row) => row.textContent?.includes('Mobile apps'));
    if (!mobile) throw new Error('Mobile apps is not listed');
    click(mobile);
    click(await continueButton(8));

    expect(await screen.findByRole('region', { name: /What to bring/ })).toBeDefined();
    const review = await fixSupAndReview();
    expect(review.textContent).toContain('SUP becomes SUPD');
    click(within(review).getByRole('button', { name: 'Start import' }));

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

  it('says connecting only lists projects', async () => {
    await renderPage(() => <ImportPage />, '/settings/import');
    click(await screen.findByRole('radio', { name: /Jira/ }));
    expect(
      screen.getByText(
        'Connect with an API token. Nothing is read beyond the list of projects until you choose what to bring.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Connecting lists projects only. It changes nothing.')).toBeDefined();
  });

  it('marks the token refused, beside the form, keeping what was typed', async () => {
    await connectToJira('wrong');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Jira refused the credentials');
    const token = screen.getByLabelText('API token');
    expect(token.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(REFUSED_TOKEN)).toBeDefined();
    expect((screen.getByLabelText('Account email') as HTMLInputElement).value).toBe(
      'rohan@acmelabs.dev',
    );
  });

  it('goes back to Connect from the stepper with the form as it was', async () => {
    await connectToJira();
    await continueButton(9);
    const steps = screen.getByRole('navigation', { name: 'Import steps' });
    expect(within(steps).getAllByRole('button')).toHaveLength(1);
    click(within(steps).getByRole('button', { name: /^Connect/ }));
    const site = (await screen.findByLabelText('Site address')) as HTMLInputElement;
    expect(site.value).toBe('https://acme.example.net');
  });

  it('cancels a running import and offers Resume', async () => {
    await connectToJira();
    click(await continueButton(9));
    await fixSupAndReview();
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
    const found = await screen.findByRole('region', { name: /Choose files/ });
    const rows = await within(found).findAllByRole('option');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('issues.csv');
    expect(rows[0]?.getAttribute('aria-selected')).toBe('true');
    await continueButton(1);
  });
});
