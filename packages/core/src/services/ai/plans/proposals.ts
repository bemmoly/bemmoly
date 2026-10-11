import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type AiPlanStepPreview,
} from '@bemmoly/shared';
import type { AiToolCall } from '../../../contracts/ai.ts';
import type { RequestContext } from '../../authz/index.ts';
import type { AiToolRegistry } from '../tools/registry.ts';
import type { AiWriteToolDefinition, RegisteredAiTool } from '../tools/types.ts';
import type { NewPlanStep } from './store.ts';

/** The most steps one plan may hold; more is a request to split, not a plan to run. */
export const MAX_PLAN_STEPS = 60;

export interface Proposal {
  tool: RegisteredAiTool & AiWriteToolDefinition;
  args: Record<string, unknown>;
}

export interface ProposalCheck {
  proposals: Proposal[];
  /** Calls left out: an unknown tool, or arguments the API schema refuses. */
  rejected: { toolName: string; problem: string }[];
}

/**
 * Turns the model's tool calls into proposals: read calls already ran and are dropped, write
 * calls are validated with the tool's input schema (the API's own), and a call the schema
 * refuses never becomes a step.
 */
export function validateProposals(
  calls: readonly AiToolCall[],
  registry: Pick<AiToolRegistry, 'get'>,
  offered: ReadonlySet<string>,
): ProposalCheck {
  const proposals: Proposal[] = [];
  const rejected: ProposalCheck['rejected'] = [];
  for (const call of calls) {
    const tool = offered.has(call.toolName) ? registry.get(call.toolName) : undefined;
    if (!tool) {
      rejected.push({ toolName: call.toolName, problem: 'is not a tool this person can use' });
      continue;
    }
    if (tool.kind === 'read') continue;
    const parsed = tool.input.safeParse(call.input);
    if (!parsed.success) {
      rejected.push({ toolName: call.toolName, problem: parsed.error.issues[0]?.message ?? '' });
      continue;
    }
    if (proposals.length >= MAX_PLAN_STEPS) {
      rejected.push({ toolName: call.toolName, problem: 'is past the step limit' });
      continue;
    }
    proposals.push({ tool, args: parsed.data as Record<string, unknown> });
  }
  return { proposals, rejected };
}

/** The words a refused check is shown with: the typed error's own message. */
export function reasonOf(error: unknown): string | null {
  if (
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    error instanceof ValidationError ||
    error instanceof ConflictError
  ) {
    return error.message;
  }
  return null;
}

const HUMAN_KEY = /^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]*$/;

/** What a step reads as when its record cannot be described: the arguments themselves. */
function fallbackPreview(proposal: Proposal): AiPlanStepPreview {
  // A human key ("PLT-211") reads well; a bare id would only be noise, so it is left out.
  const target = Object.values(proposal.args).find(
    (value): value is string => typeof value === 'string' && HUMAN_KEY.test(value),
  );
  return {
    target: (target ?? '').slice(0, 80),
    change: proposal.tool.description.split('.')[0]?.slice(0, 200) ?? proposal.tool.name,
    field: null,
    from: null,
    to: null,
    href: null,
  };
}

/**
 * Describes each proposal and checks it as the person asking. A step is DENIED when the check
 * refuses it, with the check's own words; the plan keeps it so the person sees what was left
 * out and why.
 */
export async function checkProposals(
  ctx: RequestContext,
  proposals: readonly Proposal[],
): Promise<NewPlanStep[]> {
  const steps: NewPlanStep[] = [];
  for (const proposal of proposals) {
    let preview: AiPlanStepPreview;
    try {
      preview = await proposal.tool.describe(ctx, proposal.args);
    } catch (error) {
      if (reasonOf(error) === null) throw error;
      preview = fallbackPreview(proposal);
    }
    let reason: string | null = null;
    try {
      await proposal.tool.authorize(ctx, proposal.args);
    } catch (error) {
      reason = reasonOf(error);
      if (reason === null) throw error;
    }
    steps.push({
      tool: proposal.tool.name,
      args: proposal.args,
      preview,
      permission: reason === null ? 'ALLOWED' : 'DENIED',
      reason,
    });
  }
  return steps;
}
