import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { RequestContext } from '../../authz/index.ts';
import { defineReadTool, defineWriteTool } from '../tools/define.ts';
import type { RegisteredAiTool } from '../tools/types.ts';
import { checkProposals, MAX_PLAN_STEPS, validateProposals } from './proposals.ts';

const sprintId = '0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1c';
const input = z.object({ key: z.string().regex(/^[A-Z]+-\d+$/), sprintId: z.uuid() });

const move = {
  ...defineWriteTool({
    name: 'work_move_to_sprint',
    kind: 'write',
    description: 'Move an issue to a sprint. Use after reading the sprint.',
    input,
    idempotent: true,
    describe: async (_ctx, { key }) => {
      if (key === 'PLT-404') throw new NotFoundError('The issue was not found');
      return {
        target: key,
        change: 'Title',
        field: null,
        from: 'Sprint 14',
        to: 'Sprint 15',
        href: null,
      };
    },
    authorize: async (_ctx, { key }) => {
      if (key === 'OPS-1') throw new ForbiddenError('You are not a member of Operations');
    },
    run: async () => ({}),
  }),
  moduleId: 'work',
} as RegisteredAiTool;

const read = {
  ...defineReadTool({
    name: 'work_get_issue',
    kind: 'read',
    description: 'Read',
    input: z.object({ key: z.string() }),
    execute: async () => ({}),
  }),
  moduleId: 'work',
} as RegisteredAiTool;

const registry = { get: (name: string) => [move, read].find((tool) => tool.name === name) };
const offered = new Set(['work_move_to_sprint', 'work_get_issue']);
const call = (toolName: string, args: unknown) => ({ toolCallId: 'c', toolName, input: args });
const ctx = {} as RequestContext;

describe('plan validation', () => {
  it('keeps valid write calls, drops reads, and rejects what the schema refuses', () => {
    const { proposals, rejected } = validateProposals(
      [
        call('work_get_issue', { key: 'PLT-204' }),
        call('work_move_to_sprint', { key: 'PLT-211', sprintId }),
        call('work_move_to_sprint', { key: 'PLT-219', sprintId: 'Sprint 15' }),
        call('docs_delete_space', { id: 'x' }),
      ],
      registry,
      offered,
    );
    expect(proposals.map((p) => p.args)).toEqual([{ key: 'PLT-211', sprintId }]);
    expect(rejected.map((r) => r.toolName)).toEqual(['work_move_to_sprint', 'docs_delete_space']);
  });

  it('never accepts a registered tool the person was not offered', () => {
    const { proposals } = validateProposals(
      [call('work_move_to_sprint', { key: 'PLT-211', sprintId })],
      registry,
      new Set(['work_get_issue']),
    );
    expect(proposals).toEqual([]);
  });

  it('caps a plan at the step limit', () => {
    const calls = Array.from({ length: MAX_PLAN_STEPS + 5 }, (_, i) =>
      call('work_move_to_sprint', { key: `PLT-${i}`, sprintId }),
    );
    const { proposals, rejected } = validateProposals(calls, registry, offered);
    expect(proposals).toHaveLength(MAX_PLAN_STEPS);
    expect(rejected).toHaveLength(5);
  });

  it('checks each step as the person, keeping the denied ones with the reason', async () => {
    const { proposals } = validateProposals(
      [
        call('work_move_to_sprint', { key: 'PLT-211', sprintId }),
        call('work_move_to_sprint', { key: 'OPS-1', sprintId }),
        call('work_move_to_sprint', { key: 'PLT-404', sprintId }),
      ],
      registry,
      offered,
    );
    const steps = await checkProposals(ctx, proposals);
    expect(steps.map((step) => [step.preview.target, step.permission, step.reason])).toEqual([
      ['PLT-211', 'ALLOWED', null],
      ['OPS-1', 'DENIED', 'You are not a member of Operations'],
      // A record that cannot be read is described from the arguments.
      ['PLT-404', 'ALLOWED', null],
    ]);
    expect(steps[2]?.preview.change).toBe('Move an issue to a sprint');
  });
});
