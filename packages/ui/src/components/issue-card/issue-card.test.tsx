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
  it('draws co-assignees as one named stack after the assignee', () => {
    render(
      <IssueCard
        {...base}
        assignee={{ name: 'Priya N.' }}
        coAssignees={[{ name: 'Lena T.' }, { name: 'Jonas M.' }, { name: 'Aisha K.' }]}
      />,
    );
    expect(
      screen.getByLabelText('Assigned to Priya N., Lena T., Jonas M., Aisha K.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('1 more').textContent).toBe('+1');
  });

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

  it('leaves out the key and the priority when asked, and draws no box without onCheck', () => {
    const { rerender } = render(<IssueCard {...base} priority="high" />);
    expect(screen.getByText('PLT-241')).toBeTruthy();
    expect(screen.getByLabelText('High priority')).toBeTruthy();
    rerender(
      <IssueCard issueKey="PLT-241" title="Structured logging" type="story" showKey={false} />,
    );
    expect(screen.queryByText('PLT-241')).toBeNull();
    expect(screen.queryByLabelText('High priority')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('clamps the title to two lines when compact', () => {
    render(<IssueCard {...base} density="compact" />);
    expect(screen.getByText('Structured logging').className).toContain('line-clamp-2');
  });

  it('draws every part a board can show, and leaves out each one it is not given', () => {
    const { container, rerender } = render(
      <IssueCard
        {...base}
        estimate={3}
        age={{ label: '2d' }}
        doc="RFC"
        subtasks={{ done: 1, total: 4 }}
        due={{ label: 'Oct 6', overdue: true }}
        created="Sep 28"
        reporter={{ name: 'Priya N.' }}
        assignee={{ name: 'Jonas M.' }}
      />,
    );
    expect(screen.getByRole('img', { name: 'Story' })).toBeTruthy();
    expect(screen.getByLabelText('3 points')).toBeTruthy();
    expect(screen.getByText('2d')).toBeTruthy();
    expect(screen.getByText('RFC')).toBeTruthy();
    expect(screen.getByLabelText('1 of 4 subtasks done')).toBeTruthy();
    expect(screen.getByLabelText('Due Oct 6, overdue').className).toContain('text-red-tx');
    expect(screen.getByLabelText('Created Sep 28')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Reported by Priya N.' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Jonas M.' })).toBeTruthy();

    rerender(
      <IssueCard
        issueKey="PLT-241"
        title="Structured logging"
        type="story"
        showType={false}
        showKey={false}
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).toBe('Structured logging');
  });

  it('orders each side of the footer as the board lists its fields', () => {
    const props = {
      ...base,
      estimate: 3,
      due: { label: 'Oct 6' },
      assignee: { name: 'Jonas M.' },
    } as const;
    const { rerender } = render(
      <IssueCard {...props} order={['due', 'key', 'assignee', 'estimate']} />,
    );
    const left = () => screen.getByText('PLT-241').parentElement?.textContent ?? '';
    expect(left().indexOf('Oct 6')).toBeLessThan(left().indexOf('PLT-241'));
    const right = () =>
      [...(screen.getByLabelText('3 points').parentElement?.children ?? [])].map((el) =>
        el.getAttribute('aria-label'),
      );
    expect(right()).toEqual(['Jonas M.', '3 points', 'Medium priority']);
    rerender(<IssueCard {...props} />);
    expect(right()).toEqual(['Medium priority', '3 points', 'Jonas M.']);
  });
});
