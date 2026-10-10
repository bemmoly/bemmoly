import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { USER_IDS } from '../../mocks/seed/people.ts';
import { aiOf } from '../../mocks/routes/ai-state.ts';
import { HomePage } from '../../pages/home-page.tsx';
import { renderPage } from '../../test/render.tsx';
import { mockApi } from '../../test/setup.ts';
import MorningBrief from './morning-brief.tsx';

describe('the morning brief', () => {
  it('writes, then shows what needs Rohan with its sources and steps', async () => {
    await renderPage(() => <MorningBrief userId={USER_IDS.rohan} />);
    expect(await screen.findByLabelText('Writing with AI')).toBeTruthy();
    expect(
      await screen.findByText(
        'Two things need you. PLT-204 is waiting on your review and blocks 2 issues.',
        undefined,
        { timeout: 6_000 },
      ),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Your morning brief' })).toBeTruthy();
    expect(screen.getByText('by AI · built from 31 updates')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'PLT-204' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Review PLT-204' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not useful' })).toBeTruthy();
  }, 10_000);

  it('is not drawn on Home, nor its chunk loaded, while AI is off', async () => {
    aiOf(mockApi.db).settings.privacy.enabled = false;
    await renderPage(() => <HomePage />);
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(screen.queryByText('Your morning brief')).toBeNull());
    expect(document.querySelector('.bg-ai, .text-ai-600')).toBeNull();
  });
});
