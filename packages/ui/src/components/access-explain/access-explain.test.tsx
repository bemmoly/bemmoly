import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { AccessExplain } from './access-explain.tsx';

describe('AccessExplain', () => {
  it('states the decision, the sentence and every step behind it', async () => {
    const { container } = render(
      <AccessExplain
        allowed={false}
        verdict="Not allowed"
        sentence="Tier 0 to Prod needs a Maintainer to request it."
        traceLabel="How this was decided"
        steps={[
          { key: '1', text: 'Checkout web: Developer at Checkout', effect: 'grant' },
          { key: '2', text: 'Policy Tier 0 to Prod', effect: 'deny' },
        ]}
        action={<button type="button">Ask Payments for access</button>}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Not allowed');
    expect(screen.getByRole('heading', { name: 'How this was decided' })).toBeTruthy();
    const steps = screen.getAllByRole('listitem');
    expect(steps.map((step) => step.dataset['effect'])).toEqual(['grant', 'deny']);
    expect(screen.getByRole('button', { name: 'Ask Payments for access' })).toBeTruthy();
    await expectAccessible(container);
  });

  it('leaves the trace out when there is none', () => {
    render(<AccessExplain allowed verdict="Allowed" sentence="Yes." traceLabel="How" steps={[]} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
