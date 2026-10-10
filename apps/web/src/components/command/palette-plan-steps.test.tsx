import type { AiPlan, AiPlanStep } from '@bemmoly/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { aiIntentOf } from '../../hooks/use-palette-ai.ts';
import { planRows, planState } from './palette-plan-steps.tsx';

const step = (index: number, patch: Partial<AiPlanStep> = {}): AiPlanStep => ({
  index,
  tool: 'work_move_to_sprint',
  args: {},
  preview: {
    target: `PLT-2${index}`,
    change: 'Session cleanup',
    field: null,
    from: 'Sprint 14',
    to: 'Sprint 15',
    href: null,
  },
  permission: 'ALLOWED',
  reason: null,
  status: 'proposed',
  error: null,
  undoable: false,
  ...patch,
});

const note = (index: number, target: string, patch: Partial<AiPlanStep> = {}) =>
  step(index, {
    tool: 'work_add_comment',
    preview: { target, change: 'Moved.', field: 'Comment', from: null, to: null, href: null },
    ...patch,
  });

const plan = (steps: AiPlanStep[], patch: Partial<AiPlan> = {}): AiPlan => ({
  id: '0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1b',
  request: 'move it',
  summary: null,
  status: 'proposed',
  runnable: true,
  steps,
  runId: null,
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
  approvedAt: null,
  finishedAt: null,
  ...patch,
});

describe('the palette plan table', () => {
  it('folds the same note on both issues into one signed row, as the Command mock does', () => {
    const rows = planRows(
      plan([step(0), step(1), note(2, 'PLT-211'), note(3, 'PLT-219')]),
      'Rohan',
    );
    expect(rows.map((row) => [row.target, row.indexes])).toEqual([
      ['PLT-20', [0]],
      ['PLT-21', [1]],
      ['both', [2, 3]],
    ]);
    render(<>{rows[2]?.change}</>);
    expect(screen.getByText('Comment: “Moved. — via Bemmoly for Rohan”')).toBeTruthy();
  });

  it('shows a folded row as its least finished step, and never folds a denied note in', () => {
    const rows = planRows(
      plan([
        note(0, 'PLT-211', { status: 'done' }),
        note(1, 'PLT-219', { status: 'running' }),
        note(2, 'OPS-1', { permission: 'DENIED', reason: 'Not a member' }),
      ]),
      'Rohan',
    );
    expect(rows.map((row) => [row.target, row.status, row.allowed])).toEqual([
      ['both', 'running', true],
      ['OPS-1', 'proposed', false],
    ]);
  });

  it('reads the plan state the table is drawn in', () => {
    expect(planState(plan([]))).toBe('ready');
    expect(planState(plan([], { runnable: false }))).toBe('preview');
    expect(planState(plan([], { status: 'approved' }))).toBe('running');
    expect(planState(plan([], { status: 'cancelled' }))).toBe('cancelled');
  });
});

describe('what the AI line offers', () => {
  it('plans a request, asks a question, and leaves a search alone', () => {
    expect(aiIntentOf('move everything blocked by PLT-204 to next sprint')).toBe('plan');
    expect(aiIntentOf('Assign PLT-211 to Aisha')).toBe('plan');
    expect(aiIntentOf('what changed in auth this week')).toBe('ask');
    expect(aiIntentOf('session store rollback?')).toBe('ask');
    expect(aiIntentOf('session store')).toBeNull();
    expect(aiIntentOf('mo')).toBeNull();
  });
});
