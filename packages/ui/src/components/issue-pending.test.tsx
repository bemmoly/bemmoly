import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IssueCard } from './issue-card/index.ts';
import { IssueRow } from './issue-row/index.ts';

describe('pending issues', () => {
  it('marks a card and a row busy and dims them while an edit is on its way', () => {
    render(
      <div>
        <IssueCard
          issueKey="PLT-1"
          title="Card"
          type="task"
          priority="low"
          pending
          onSelect={() => {}}
        />
        <IssueRow
          issueKey="PLT-2"
          title="Row"
          type="task"
          priority="low"
          status={{ stage: 'todo' }}
          pending
        />
      </div>,
    );
    const card = screen.getByRole('button', { name: /Card/ });
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(card.className).toContain('opacity-60');
    const row = screen.getByText('Row').closest('[aria-busy]');
    expect(row?.className).toContain('opacity-60');
  });

  it('leaves settled issues alone', () => {
    render(<IssueCard issueKey="PLT-1" title="Card" type="task" priority="low" />);
    const card = screen.getByText('Card').parentElement;
    expect(card?.hasAttribute('aria-busy')).toBe(false);
    expect(card?.className).not.toContain('opacity-60');
  });
});
