import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SETUP_STEPS } from '../../hooks/use-setup-wizard.ts';
import { importsApi } from '../../lib/imports-api.ts';
import { click, type } from '../../pages/settings/import-test-steps.tsx';
import { renderPage } from '../../test/render.tsx';
import { StepImport } from './step-import.tsx';
import type { StepNav } from './step-footer.tsx';

const nav: StepNav = {
  label: 'Continue',
  counter: 'Step 3 of 7',
  canSkip: true,
  canGoBack: true,
  next: vi.fn(),
  skip: vi.fn(),
  back: vi.fn(),
};

afterEach(() => vi.restoreAllMocks());

describe('the wizard import step', () => {
  it('connects, chooses, then runs in the background with the defaults', async () => {
    const update = vi.spyOn(importsApi, 'update');
    const run = vi.spyOn(importsApi, 'run');
    await renderPage(() => <StepImport nav={nav} />, '/setup');
    click(await screen.findByRole('radio', { name: /Jira/ }));
    type('Site address', 'https://acme.example.net');
    type('Account email', 'rohan@acmelabs.dev');
    type('API token', 'a-token');
    click(screen.getByRole('button', { name: 'Connect' }));
    const start = await screen.findByRole(
      'button',
      { name: 'Start import of 9' },
      { timeout: 3000 },
    );
    // No Options or Review: the short path goes straight to the run.
    expect(screen.queryByRole('navigation', { name: 'Import steps' })).toBeNull();
    click(start);
    await waitFor(() => expect(run).toHaveBeenCalledWith(expect.any(String), {}));
    expect(update).toHaveBeenCalledWith(expect.any(String), { onClash: 'suffix' });
    expect(
      await screen.findByText('Importing 9 projects from Jira.', {}, { timeout: 3000 }),
    ).toBeDefined();
    expect(screen.getByText(/keeps running while you finish setup/)).toBeDefined();
    expect(screen.getByRole('progressbar', { name: 'Import progress' })).toBeDefined();
    expect(screen.queryByRole('region', { name: /What to bring/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Skip for now' })).toBeDefined();
  });

  it('promises nothing the importer does not do', () => {
    const step = SETUP_STEPS.find((entry) => entry.name === 'Import');
    expect(step?.subtitle).not.toMatch(/history/i);
    expect(step?.subtitle).toMatch(/keys, comments, attachments and page trees/);
  });
});
