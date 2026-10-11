import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandAiLine, CommandAiNotice, CommandAiThinking } from './command-ai.tsx';
import { CommandPlan, type PlanStep } from './command-plan.tsx';

const STEPS: PlanStep[] = [
  { id: 0, target: 'PLT-211', change: 'Session cleanup', field: 'Sprint 15', allowed: true },
  { id: 1, target: 'PLT-219', change: 'Legacy cookie path', field: 'Sprint 15', allowed: true },
  {
    id: 2,
    target: 'OPS-12',
    change: 'Rotate the pager',
    field: 'Sprint 15',
    allowed: false,
    reason: 'You are not a member of Operations.',
  },
];

const rows = () => within(screen.getByRole('table', { name: 'Plan steps' })).getAllByRole('row');

describe('CommandPlan', () => {
  it('waits for a confirm and counts only the allowed steps', () => {
    const onRun = vi.fn();
    render(<CommandPlan summary="Move two issues." steps={STEPS} onRun={onRun} onEdit={vi.fn()} />);
    expect(screen.getByText('nothing happens until you confirm')).toBeTruthy();
    expect(rows()).toHaveLength(4);
    expect(within(rows()[3]!).getByText('Denied')).toBeTruthy();
    expect(within(rows()[3]!).getByText('You are not a member of Operations.')).toBeTruthy();
    expect(screen.getByText("1 change you can't make will be left out.")).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Run 2 changes/ }));
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('lets the person keep fewer steps while editing', () => {
    const onToggle = vi.fn();
    render(
      <CommandPlan
        summary="Move two issues."
        steps={STEPS}
        editing
        kept={new Set([1])}
        onToggle={onToggle}
        onRun={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    // Denied steps get no checkbox: they never run.
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    fireEvent.click(boxes[0]!);
    expect(onToggle).toHaveBeenCalledWith(0);
    expect(screen.getByRole('button', { name: /Run 1 change$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Done editing' })).toBeTruthy();
  });

  it('shows each step land while running, with progress and Stop', () => {
    const onStop = vi.fn();
    const steps = STEPS.map((step, i) => ({
      ...step,
      status: (['done', 'running', 'skipped'] as const)[i],
    }));
    render(<CommandPlan summary="Moving." steps={steps} state="running" onStop={onStop} />);
    expect(screen.getByText('1 of 2 changes made')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Plan progress' })).toBeTruthy();
    expect(within(rows()[2]!).getByText('Running')).toBeTruthy();
    expect(within(rows()[3]!).getByText('Left out')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Run/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledOnce();
  });

  it('offers Undo when done, and says which step failed and why', () => {
    const onUndo = vi.fn();
    const steps = STEPS.slice(0, 2).map((step, i) => ({
      ...step,
      status: (['done', 'failed'] as const)[i],
      error: i === 1 ? 'PLT-219 is in another project now.' : null,
    }));
    render(<CommandPlan summary="Moved." steps={steps} state="failed" onUndo={onUndo} />);
    expect(screen.getByText('1 of 2 made, 1 failed')).toBeTruthy();
    expect(screen.getByText('PLT-219 is in another project now.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('never offers Run on a preview', () => {
    render(<CommandPlan summary="Move two issues." steps={STEPS} state="preview" />);
    expect(screen.getByText('Preview only')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Run/ })).toBeNull();
  });
});

describe('the palette AI parts', () => {
  it('hands the typed words to Bemmoly from the AI line', () => {
    const onSelect = vi.fn();
    render(<CommandAiLine label="Plan with Bemmoly" query="move PLT-211" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('option', { name: /Plan with Bemmoly/ }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('shows thinking as busy, and problems as alerts with a next step', () => {
    const retry = vi.fn();
    render(
      <>
        <CommandAiThinking />
        <CommandAiNotice
          tone="problem"
          title="The AI provider didn't answer"
          action={{ label: 'Try again', onClick: retry }}
        />
      </>,
    );
    expect(
      screen.getByRole('region', { name: 'Drawing up a plan' }).getAttribute('aria-busy'),
    ).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain("didn't answer");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
