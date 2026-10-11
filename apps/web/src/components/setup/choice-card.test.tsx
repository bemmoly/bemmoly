import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChoiceCard } from './choice-card.tsx';

describe('ChoiceCard', () => {
  it('draws the icon in the tile in place of the initials', () => {
    render(
      <ChoiceCard
        initials="AB"
        icon={<svg data-testid="mark" />}
        name="Alpha Beta"
        selected={false}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByTestId('mark')).toBeTruthy();
    expect(screen.queryByText('AB')).toBeNull();
  });

  it('shows the initials when there is no icon', () => {
    render(<ChoiceCard initials="AB" name="Alpha Beta" selected onSelect={() => undefined} />);
    expect(screen.getByText('AB')).toBeTruthy();
    expect(screen.getByRole('radio').getAttribute('aria-checked')).toBe('true');
  });

  it('keeps a coming-soon card focusable but never selectable', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ChoiceCard
        initials="AB"
        name="Alpha Beta"
        description="What it will do"
        badge="RECOMMENDED"
        comingSoon
        selected
        onSelect={onSelect}
      />,
    );
    const card = screen.getByRole('radio', { name: /Alpha Beta/ });
    expect(card.getAttribute('aria-disabled')).toBe('true');
    expect(card.getAttribute('aria-checked')).toBe('false');
    expect(card.hasAttribute('disabled')).toBe(false);
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(screen.queryByText('RECOMMENDED')).toBeNull();
    await user.tab();
    expect(document.activeElement).toBe(card);
    await user.click(card);
    await user.keyboard('{Enter} ');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
