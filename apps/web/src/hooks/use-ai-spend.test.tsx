import type { AiBudgetStatus } from '@bemmoly/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aiOf } from '../mocks/routes/ai-state.ts';
import { SystemPage } from '../pages/settings/system-page.tsx';
import { renderPage } from '../test/render.tsx';
import { mockApi } from '../test/setup.ts';
import { spendText } from './use-ai-spend.ts';

const status: AiBudgetStatus = {
  month: '2026-10',
  spentUsd: 12.4,
  budgetUsd: 50,
  ratio: 0.248,
  state: 'ok',
  pausedRoles: [],
};

async function spendRow() {
  const name = await screen.findByText('AI spend');
  return within(name.closest('li') ?? name.parentElement!.parentElement!);
}

describe('System status › AI spend', () => {
  it('words the spend against the budget, or alone without one', () => {
    expect(spendText(status)).toBe('$12.40 of $50.00 this month');
    expect(spendText({ ...status, budgetUsd: null, ratio: null, state: 'unlimited' })).toBe(
      '$12.40 this month, no budget set',
    );
  });

  it('shows this month’s spend with a link to Usage while AI is on', async () => {
    await renderPage(() => <SystemPage />);
    const row = await spendRow();
    expect(await row.findByText(/ of \$150\.00 this month$/)).toBeTruthy();
    expect(row.getByRole('link', { name: 'Usage' }).getAttribute('href')).toBe(
      '/settings/ai/usage',
    );
  });

  it('says AI is off, and where to turn it on, to someone who configures AI', async () => {
    aiOf(mockApi.db).settings.privacy.enabled = false;
    await renderPage(() => <SystemPage />);
    const row = await spendRow();
    expect(await row.findByText('AI is off')).toBeTruthy();
    expect(row.getByRole('link', { name: 'AI and models' }).getAttribute('href')).toBe(
      '/settings/ai',
    );
  });

  it('draws no AI spend row for someone who cannot configure AI', async () => {
    mockApi.reset('member');
    await renderPage(() => <SystemPage />);
    await screen.findByText('System status');
    expect(screen.queryByText('AI spend')).toBeNull();
  });
});
