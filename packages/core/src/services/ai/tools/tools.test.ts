import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { RequestContext } from '../../authz/index.ts';
import { createTestAi } from '../test-ai.ts';
import {
  aiToolContribution,
  defineReadTool,
  defineWriteTool,
  isAiToolDefinition,
  requestToolInput,
} from './define.ts';
import { createAiToolRegistry, toolSetFor } from './registry.ts';

// An API's own schemas, as a module's shared folder would declare them.
const keyParams = z.object({ key: z.string().regex(/^[A-Z][A-Z0-9]+-\d+$/) });
const updateBody = z
  .object({ sprintId: z.uuid().nullable(), title: z.string().trim().min(1).max(500) })
  .partial();

const fakeAuthz = (access: boolean): RequestContext['authz'] => ({
  canAccess: async () => access,
  modulesFor: async () => new Set(access ? ['work'] : []),
  authorize: async () => undefined,
  can: async () => true,
  workspaceCapabilities: async () => [],
  isOrgAdmin: async () => false,
  whoCan: async (userIds) => [...userIds],
  within: () => fakeAuthz(access),
});

const ctx = (access = true): RequestContext => ({
  actor: { kind: 'user', id: '0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1b' },
  authz: fakeAuthz(access),
});

const getIssue = defineReadTool({
  name: 'work_get_issue',
  kind: 'read',
  description: 'One issue by key',
  input: keyParams,
  execute: async (_ctx, { key }) => {
    if (key === 'PLT-404') throw new NotFoundError('The issue was not found');
    return { key, title: 'Session store migration' };
  },
});

const moveIssue = defineWriteTool({
  name: 'work_move_to_sprint',
  kind: 'write',
  description: 'Move an issue to a sprint',
  input: requestToolInput(keyParams, updateBody.pick({ sprintId: true }).required()),
  idempotent: true,
  describe: async (_ctx, input) => ({
    target: input.key,
    change: 'Move',
    field: null,
    from: null,
    to: input.sprintId,
    href: null,
  }),
  authorize: async () => {
    throw new ForbiddenError('No');
  },
  run: async () => ({ undo: null }),
});

describe('tool generation from the API schemas', () => {
  it('validates the model arguments exactly as the request would be', () => {
    const sprintId = '0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1c';
    expect(moveIssue.input.safeParse({ key: 'PLT-211', sprintId }).success).toBe(true);
    // The body's own rules hold: a sprint id must be a uuid, the key must be a key.
    expect(moveIssue.input.safeParse({ key: 'PLT-211', sprintId: 'Sprint 15' }).success).toBe(
      false,
    );
    expect(moveIssue.input.safeParse({ key: 'plt 211', sprintId }).success).toBe(false);
    const schema = z.toJSONSchema(moveIssue.input) as { properties: object; required: string[] };
    expect(Object.keys(schema.properties)).toEqual(['key', 'sprintId']);
    expect(schema.required).toEqual(['key', 'sprintId']);
  });

  it('gives read tools an execute and leaves write tools as proposals', async () => {
    const set = toolSetFor([getIssue, moveIssue], ctx());
    expect(Object.keys(set)).toEqual(['work_get_issue', 'work_move_to_sprint']);
    expect(set['work_get_issue']?.inputSchema).toBe(keyParams);
    expect(set['work_move_to_sprint']?.execute).toBeUndefined();
    const found = await set['work_get_issue']?.execute?.({ key: 'PLT-204' } as never, {});
    expect(found).toEqual({ key: 'PLT-204', title: 'Session store migration' });
    // A typed refusal goes back to the model as words, not as a failed plan.
    const missing = await set['work_get_issue']?.execute?.({ key: 'PLT-404' } as never, {});
    expect(missing).toEqual({ error: 'The issue was not found' });
  });

  it('runs read tools and records write calls through the facade', async () => {
    const ai = createTestAi();
    ai.queue(
      { toolCalls: [{ toolName: 'work_get_issue', input: { key: 'PLT-204' } }] },
      {
        toolCalls: [
          {
            toolName: 'work_move_to_sprint',
            input: { key: 'PLT-211', sprintId: '0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1c' },
          },
        ],
      },
    );
    const result = await ai.generate({
      role: 'strong',
      purpose: 'plan',
      prompt: 'move everything blocked by PLT-204 to next sprint',
      tools: toolSetFor([getIssue, moveIssue], ctx()),
      maxSteps: 4,
    });
    // Every call of every step comes back; only the read ran.
    expect(result.toolCalls.map((call) => call.toolName)).toEqual([
      'work_get_issue',
      'work_move_to_sprint',
    ]);
    expect(result.toolResults.map((call) => call.toolName)).toEqual(['work_get_issue']);
    expect(ai.calls).toHaveLength(2);
  });
});

describe('the tool registry', () => {
  it('keeps only real definitions and names the module', () => {
    const registry = createAiToolRegistry({
      contributions: () => [
        { ...aiToolContribution(getIssue), moduleId: 'work' },
        { name: 'legacy', description: 'not a tool', definition: { kind: 'other' }, moduleId: 'x' },
      ],
    });
    expect(registry.list().map((tool) => [tool.name, tool.moduleId])).toEqual([
      ['work_get_issue', 'work'],
    ]);
    expect(isAiToolDefinition(moveIssue)).toBe(true);
    expect(isAiToolDefinition({ name: 'x', kind: 'write', input: keyParams })).toBe(false);
  });

  it('refuses names a model API would reject', () => {
    expect(() => aiToolContribution({ ...getIssue, name: 'work.get-issue' })).toThrow(/prefix/);
  });

  it('offers only the tools of modules that are on and open to the person', async () => {
    const registry = createAiToolRegistry({
      contributions: () => [
        { ...aiToolContribution(getIssue), moduleId: 'work' },
        { ...aiToolContribution({ ...moveIssue, name: 'docs_move_page' }), moduleId: 'docs' },
      ],
      isEnabled: (id) => id === 'work',
    });
    expect((await registry.available(ctx())).map((tool) => tool.name)).toEqual(['work_get_issue']);
    expect(await registry.available(ctx(false))).toEqual([]);
  });
});
