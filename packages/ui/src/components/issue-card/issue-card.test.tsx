import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IssueCard } from './issue-card.tsx';

const base = {
  issueKey: 'PLT-241',
  title: 'Structured logging',
  type: 'story',
  priority: 'medium',
} as const;

describe('IssueCard', () => {
  it('offers a selection box that takes the click and reports the modifiers', () => {
    const onCheck = vi.fn();
    const onSelect = vi.fn();
    render(<IssueCard {...base} onCheck={onCheck} onSelect={onSelect} />);
    const box = screen.getByRole('checkbox', { name: 'Select PLT-241' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    // Out of the tab order: the card is the stop and the keyboard selects with x.
    expect(box.tabIndex).toBe(-1);
    fireEvent.click(box, { shiftKey: true });
    expect(onCheck).toHaveBeenCalledOnce();
    expect(onCheck.mock.calls[0]?.[0].shiftKey).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps the box shown while checked or while anything is selected', () => {
    const { rerender } = render(<IssueCard {...base} onCheck={() => undefined} />);
    expect(screen.getByRole('checkbox').className).toContain('opacity-0');
    rerender(<IssueCard {...base} onCheck={() => undefined} selecting />);
    expect(screen.getByRole('checkbox').className).not.toContain('opacity-0');
    rerender(<IssueCard {...base} onCheck={() => undefined} checked />);
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  });
});
