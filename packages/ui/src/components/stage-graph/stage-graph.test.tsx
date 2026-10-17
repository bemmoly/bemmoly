import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { nextNode } from './navigate.ts';
import { StageGraph, type StageGraphStage } from './stage-graph.tsx';

const STAGES: StageGraphStage[] = [
  { index: 0, nodes: [{ id: 'build', name: 'Build', state: 'passed', detail: '1m 48s' }] },
  {
    index: 1,
    nodes: [
      { id: 'unit-1', name: 'Unit 1 of 2', state: 'passed', detail: '2m 41s' },
      { id: 'unit-2', name: 'Unit 2 of 2', state: 'failed', detail: '2 failed' },
    ],
  },
  { index: 2, nodes: [{ id: 'deploy', name: 'Deploy', state: 'skipped', detail: 'needs tests' }] },
];

const words = (state: string) => state[0]?.toUpperCase() + state.slice(1);

describe('StageGraph', () => {
  it('names every node with its state and detail, and is accessible', async () => {
    const { container } = render(
      <StageGraph stages={STAGES} ariaLabel="Stages" stateLabel={words} selectedId="unit-2" />,
    );
    expect(screen.getByRole('group', { name: 'Stages' })).toBeTruthy();
    const failed = screen.getByRole('button', { name: 'Unit 2 of 2, Failed, 2 failed' });
    expect(failed.getAttribute('aria-pressed')).toBe('true');
    expect(failed.className).toContain('ring-red');
    await expectAccessible(container);
  });

  it('rings a selected node that did not fail in the accent and dims skipped work', () => {
    render(<StageGraph stages={STAGES} ariaLabel="Stages" stateLabel={words} selectedId="build" />);
    expect(screen.getByRole('button', { name: /^Build,/ }).className).toContain('ring-acc');
    expect(screen.getByRole('button', { name: /^Deploy,/ }).className).toContain('opacity-60');
  });

  it('is one tab stop and moves with arrows, J and K, selecting with Enter', () => {
    const onSelect = vi.fn();
    render(
      <StageGraph
        stages={STAGES}
        ariaLabel="Stages"
        stateLabel={words}
        selectedId="unit-1"
        onSelect={onSelect}
      />,
    );
    const tabbable = screen.getAllByRole('button').filter((b) => b.tabIndex === 0);
    expect(tabbable.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Unit 1 of 2, Passed, 2m 41s',
    ]);
    const start = tabbable[0] as HTMLElement;
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Unit 2 of 2/);
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowRight' });
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Deploy/);
    fireEvent.keyDown(document.activeElement as Element, { key: 'k' });
    expect(document.activeElement?.getAttribute('aria-label')).toMatch(/^Unit 2 of 2/);
    fireEvent.click(document.activeElement as Element);
    expect(onSelect).toHaveBeenCalledWith('unit-2');
  });

  it('draws one connector between columns when there are no edges, curves when there are', () => {
    const { container, rerender } = render(
      <StageGraph stages={STAGES} ariaLabel="Stages" stateLabel={words} />,
    );
    expect(container.querySelector('[data-part="edges"]')).toBeNull();
    rerender(
      <StageGraph
        stages={STAGES}
        edges={[{ from: 'build', to: 'unit-1' }]}
        ariaLabel="Stages"
        stateLabel={words}
      />,
    );
    expect(container.querySelectorAll('[data-part="edges"] path').length).toBe(1);
  });
});

describe('nextNode', () => {
  const columns = [['a'], ['b', 'c'], ['d']];
  it('steps between columns keeping the row, and mirrors arrows right to left', () => {
    expect(nextNode(columns, 'c', 'ArrowRight', false)).toBe('d');
    expect(nextNode(columns, 'c', 'ArrowLeft', false)).toBe('a');
    expect(nextNode(columns, 'c', 'ArrowLeft', true)).toBe('d');
    expect(nextNode(columns, 'b', 'ArrowDown', false)).toBe('c');
    expect(nextNode(columns, 'b', 'ArrowUp', false)).toBe('b');
    expect(nextNode(columns, 'a', 'k', false)).toBe('a');
    expect(nextNode(columns, 'a', 'End', false)).toBe('d');
    expect(nextNode(columns, 'a', 'x', false)).toBeNull();
  });
});
