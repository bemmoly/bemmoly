import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible, expectFocusRing } from '../testing/a11y.ts';
import { AiInsightBody } from './ai-surface/ai-insight-body.tsx';
import { AiSummary } from './ai-surface/ai-cards.tsx';

const citations = [
  { id: 'c1', label: 'PLT-204', location: 'description', href: '/work/issue/PLT-204' },
  { id: 'c2', label: "Jonas M.'s comment", location: '2026-10-08', href: '/work/issue/PLT-204' },
];

describe('AiInsightBody', () => {
  it('links every claim to its sources and marks a claim with none as unsourced', async () => {
    const { container } = render(
      <AiSummary source="by AI · from 14 comments">
        <AiInsightBody
          state="ready"
          citations={citations}
          points={[
            { text: 'Review of PR 4821 waits on Jonas.', cites: ['c1', 'c2'] },
            { text: 'It will merge Friday.', cites: [] },
          ]}
        />
      </AiSummary>,
    );
    const link = screen.getByRole('link', { name: 'PLT-204' });
    expect(link.getAttribute('href')).toBe('/work/issue/PLT-204');
    expect(link.getAttribute('title')).toBe('description');
    expectFocusRing(link);
    expect(screen.getByRole('link', { name: "Jonas M.'s comment" })).toBeTruthy();
    expect(screen.getAllByText('Unsourced')).toHaveLength(1);
    expect(container.textContent).toContain('It will merge Friday. Unsourced');
    await expectAccessible(container);
  });

  it('shows a busy skeleton while the model writes', async () => {
    const { container } = render(<AiInsightBody state="loading" lines={2} />);
    expect(screen.getByLabelText('Writing with AI').getAttribute('aria-busy')).toBe('true');
    expect(container.querySelectorAll('[aria-hidden] > span')).toHaveLength(2);
    await expectAccessible(container);
  });

  it("says it couldn't get one and offers Try again", async () => {
    const onRetry = vi.fn();
    const { container } = render(
      <AiInsightBody
        state="failed"
        failedLabel="Couldn’t get a TL;DR"
        failedDetail="The provider returned a rate limit"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Couldn’t get a TL;DR');
    expect(screen.getByText('The provider returned a rate limit')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
    await expectAccessible(container);
  });

  it('follows a citation in the app when given a navigator', () => {
    const onNavigate = vi.fn();
    render(
      <AiInsightBody
        state="ready"
        citations={citations}
        points={[{ text: 'Waiting on review.', cites: ['c1'] }]}
        onNavigate={onNavigate}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'PLT-204' }));
    expect(onNavigate).toHaveBeenCalledWith('/work/issue/PLT-204');
  });
});
