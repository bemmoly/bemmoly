import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { RuleChip } from './rule-chip.tsx';
import { StatusNode, StatusNodeHandle } from './status-node.tsx';
import { TransitionEdge, TransitionLabel, WorkflowCanvas } from './edges.tsx';

describe('workflow canvas editing states', () => {
  it('marks an invalid node and edge, and selects a transition from its label', async () => {
    const onSelect = vi.fn();
    const { container } = render(
      <WorkflowCanvas label="Software workflow" edges={<TransitionEdge d="M0 0 L 9 9" invalid />}>
        <StatusNode name="Done" category="done" x="80%" y="50%" invalid />
        <StatusNodeHandle x="80%" y="50%" />
        <TransitionLabel x="60%" y="50%" interactive selected onClick={onSelect}>
          Pass QA
          <RuleChip kind="condition" count={1} />
          <RuleChip kind="post" count={2} />
        </TransitionLabel>
      </WorkflowCanvas>,
    );
    await expectAccessible(container);
    const node = screen.getByRole('button', { name: /Done/ });
    expect(node.getAttribute('aria-invalid')).toBe('true');
    expect(node.className).toContain('border-danger');
    expect(node.textContent).toBe('DoneDone');
    expect(container.querySelector('path[marker-end="url(#workflow-arrow-danger)"]')).toBeTruthy();
    const label = screen.getByRole('button', { name: /^Pass QA\s*1 condition\s*2 posts$/ });
    expect(label.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(label);
    expect(onSelect).toHaveBeenCalled();
  });

  it('keeps a plain label out of the tab order', () => {
    render(
      <TransitionLabel x="0" y="0">
        Approve
      </TransitionLabel>,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Approve').tagName).toBe('SPAN');
  });
});
