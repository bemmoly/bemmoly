import type { AiPlanStepPreview } from '@bemmoly/shared';
import type { z } from 'zod';
import type { RequestContext } from '../../authz/index.ts';

/*
 * What a module hands `ctx.ai.addTool` as `definition`. The model never holds a write
 * capability: read tools run while the plan is drawn up, write tools are only recorded and
 * become plan steps a person confirms. Every input schema is built from the module's API
 * schemas (`requestToolInput`), so the model's arguments are validated like a request body.
 */

/** A step being run: the person's request context with the plan's actor, and how to sign. */
export interface AiToolRunContext extends RequestContext {
  planId: string;
  stepIndex: number;
  /** "via Bemmoly for Rohan": appended to anything a plan writes in a person's name. */
  attribution: string;
  /** The planning call's ai_runs row, for records that keep it (a comment's ai_run_id). */
  runId: string | null;
}

interface AiToolBase<Input> {
  /**
   * Namespaced by module with an underscore, since model APIs allow only letters, digits, _
   * and -: `work_move_to_sprint`.
   */
  name: string;
  /** What the model reads to choose the tool: when to use it and what it returns. */
  description: string;
  input: z.ZodType<Input>;
}

/** Looks things up while planning, as the person asking; the result goes back to the model. */
export interface AiReadToolDefinition<Input = unknown> extends AiToolBase<Input> {
  kind: 'read';
  execute(ctx: RequestContext, input: Input): Promise<unknown>;
}

/** What a write leaves behind: undo data when it can be put back, and where to see it. */
export interface AiWriteOutcome<Undo = unknown> {
  undo?: Undo | null;
}

/** A change a plan proposes and a person runs. */
export interface AiWriteToolDefinition<Input = unknown, Undo = unknown> extends AiToolBase<Input> {
  kind: 'write';
  /**
   * How the step reads in the plan, looked up as the person asking. Never writes. When the
   * record cannot be read, throw; the plan falls back to the arguments.
   */
  describe(ctx: RequestContext, input: Input): Promise<AiPlanStepPreview>;
  /**
   * The checks the service will make, without making the change: throws ForbiddenError (the
   * step is DENIED) or NotFoundError / ValidationError (the step is DENIED with that reason).
   */
  authorize(ctx: RequestContext, input: Input): Promise<void>;
  /** Makes the change through the module's own services, the code path the UI uses. */
  run(ctx: AiToolRunContext, input: Input): Promise<AiWriteOutcome<Undo>>;
  /** Puts a run change back. Absent when the action has no undo (a comment stays). */
  undo?(ctx: AiToolRunContext, undo: Undo): Promise<void>;
  /**
   * Running it twice leaves the same state (setting a field). A step interrupted mid-run is
   * retried only when this is true; otherwise it is marked failed for the person to check.
   */
  idempotent: boolean;
}

/** Any tool, whatever its input; methods are bivariant, so typed definitions fit. */
export type AiToolDefinition =
  AiReadToolDefinition<unknown> | AiWriteToolDefinition<unknown, unknown>;

/** A definition with the module that registered it. */
export type RegisteredAiTool = AiToolDefinition & { moduleId: string };
