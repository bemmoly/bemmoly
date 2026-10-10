import { screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderPage } from '../../../test/render.tsx';
import { mockApi } from '../../../test/setup.ts';
import { AiPrivacyPage } from './ai-privacy-page.tsx';
import { AiPromptsPage } from './ai-prompts-page.tsx';
import { AiUsagePage } from './ai-usage-page.tsx';

describe('AiPrivacyPage', () => {
  it('applies a switch at once and excludes a project by name', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AiPrivacyPage />);
    await user.click(await screen.findByRole('switch', { name: 'Hide email addresses' }));
    await waitFor(() => expect(mockApi.db.ai.settings.privacy.redactEmails).toBe(true));
    await user.click(await screen.findByRole('combobox', { name: 'Exclude a project…' }));
    await user.click(await screen.findByRole('option', { name: /Support Desk/ }));
    await waitFor(() => expect(mockApi.db.ai.settings.privacy.excludedProjectIds).toHaveLength(1));
    const chip = await screen.findByRole('button', { name: /Stop excluding Support Desk/ });
    await user.click(chip);
    await waitFor(() => expect(mockApi.db.ai.settings.privacy.excludedProjectIds).toHaveLength(0));
  });
});

describe('AiUsagePage', () => {
  it('shows spend by role, then purpose, with tabular totals', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AiUsagePage />);
    const table = await screen.findByRole('table', { name: 'Usage by role' });
    expect(within(table).getByText('Standard')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: 'Purpose' }));
    const byPurpose = await screen.findByRole('table', { name: 'Usage by purpose' });
    expect(within(byPurpose).getByText('Palette plans')).toBeTruthy();
  });

  it('explains in words that standard and strong pause at 100%', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AiUsagePage />);
    await user.click(await screen.findByRole('button', { name: 'Edit Monthly budget' }));
    const field = screen.getByLabelText('Limit in US dollars');
    await user.clear(field);
    await user.type(field, 'lots');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Enter an amount in US dollars/)).toBeTruthy();
    await user.clear(field);
    await user.type(field, '40{Enter}');
    await waitFor(() => expect(mockApi.db.ai.settings.budget.monthlyBudgetUsd).toBe(40));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Standard and strong are paused until/);
    expect(alert.textContent).toMatch(/Fast suggestions and search keep working/);
  });

  it('warns at 80% of the budget', async () => {
    mockApi.db.ai.settings.budget.monthlyBudgetUsd = 70;
    await renderPage(() => <AiUsagePage />);
    expect(await screen.findByText(/Over 80% of this month’s budget is spent/)).toBeTruthy();
  });
});

describe('AiPromptsPage', () => {
  it('saves an override, shows its changes and resets it', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AiPromptsPage />, '/?prompt=ai.brief');
    const dialog = await screen.findByRole('dialog', { name: 'The morning brief on Home' });
    const textarea = within(dialog).getByLabelText('Prompt');
    await user.type(textarea, '\nKeep it under 80 words.');
    await user.click(within(dialog).getByRole('radio', { name: 'Changes from the default' }));
    expect(within(dialog).getByText('Keep it under 80 words.')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Save override' }));
    await waitFor(() =>
      expect(mockApi.db.ai.prompts.find((p) => p.id === 'ai.brief')?.override).not.toBeNull(),
    );
    await user.click(await screen.findByRole('row', { name: /ai\.brief/ }));
    await user.click(await screen.findByRole('button', { name: 'Reset to default' }));
    await waitFor(() =>
      expect(mockApi.db.ai.prompts.find((p) => p.id === 'ai.brief')?.override).toBeNull(),
    );
  });

  it('refuses a variable the prompt does not have, under the field', async () => {
    const user = userEvent.setup();
    await renderPage(() => <AiPromptsPage />, '/?prompt=ai.plan');
    const dialog = await screen.findByRole('dialog', { name: /palette request/ });
    await user.type(within(dialog).getByLabelText('Prompt'), ' {{{{secret}}');
    expect(within(dialog).getByText(/isn’t a variable of this prompt/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Save override' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
