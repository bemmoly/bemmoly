import { z } from 'zod';
import { timestampSchema } from '../contracts/common.ts';

/*
 * The ⌘K palette's plans (tech design §11.4): a request in plain words becomes proposed tool
 * calls, each checked against the person's permissions, and nothing changes until that person
 * runs the allowed steps. Execution is a job; progress reaches the browser as a realtime
 * invalidation of kind `ai.plan` and the client refetches the plan.
 */

export const AI_PLAN_STATUSES = [
  'proposed',
  'approved',
  'running',
  'done',
  'failed',
  'cancelled',
] as const;
export const aiPlanStatusSchema = z.enum(AI_PLAN_STATUSES);
export type AiPlanStatus = z.infer<typeof aiPlanStatusSchema>;

/**
 * A step's own life: `proposed` until the plan runs, then `pending` (chosen to run) or
 * `skipped` (left out, or denied), `running`, and `done` or `failed`; `undone` after Undo.
 */
export const AI_PLAN_STEP_STATUSES = [
  'proposed',
  'pending',
  'skipped',
  'running',
  'done',
  'failed',
  'undone',
] as const;
export const aiPlanStepStatusSchema = z.enum(AI_PLAN_STEP_STATUSES);
export type AiPlanStepStatus = z.infer<typeof aiPlanStepStatusSchema>;

/** The permission check made as the person asking, when the plan was drawn up. */
export const AI_PLAN_PERMISSIONS = ['ALLOWED', 'DENIED'] as const;
export const aiPlanPermissionSchema = z.enum(AI_PLAN_PERMISSIONS);
export type AiPlanPermission = z.infer<typeof aiPlanPermissionSchema>;

/**
 * How a step reads in the plan table: the record it touches ("PLT-211", or "both"), what it
 * is ("Session cleanup background job"), and the field change ("Sprint 14" → "Sprint 15").
 */
export const aiPlanStepPreviewSchema = z.object({
  target: z.string().max(80),
  change: z.string().max(2000),
  /** The field name when there is no from → to: "Comment", "Label". */
  field: z.string().max(80).nullable(),
  from: z.string().max(200).nullable(),
  to: z.string().max(200).nullable(),
  /** Where the record lives in the app, for the results list. */
  href: z.string().max(500).nullable(),
});
export type AiPlanStepPreview = z.infer<typeof aiPlanStepPreviewSchema>;

export const aiPlanStepSchema = z.object({
  index: z.number().int().nonnegative(),
  /** The registered tool name: `work.move_to_sprint`. */
  tool: z.string(),
  /** The arguments the model proposed, already validated against the tool's schema. */
  args: z.record(z.string(), z.unknown()),
  preview: aiPlanStepPreviewSchema,
  permission: aiPlanPermissionSchema,
  /** Why a step is denied, in plain words. */
  reason: z.string().nullable(),
  status: aiPlanStepStatusSchema,
  /** Why a run failed, in plain words. */
  error: z.string().nullable(),
  /** The step is done and its tool can put the change back. */
  undoable: z.boolean(),
});
export type AiPlanStep = z.infer<typeof aiPlanStepSchema>;

export const aiPlanSchema = z.object({
  id: z.uuid(),
  request: z.string(),
  /** The model's one-sentence account of the plan; null when it gave none. */
  summary: z.string().nullable(),
  status: aiPlanStatusSchema,
  /**
   * False when "Let AI actions change data" is off: the plan is a preview the palette shows
   * but can never run.
   */
  runnable: z.boolean(),
  steps: z.array(aiPlanStepSchema),
  /** The ai_runs row of the planning call, for "Not useful" and the audit trail. */
  runId: z.uuid().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  approvedAt: timestampSchema.nullable(),
  finishedAt: timestampSchema.nullable(),
});
export type AiPlan = z.infer<typeof aiPlanSchema>;

/** Where the palette was opened, so "this issue" and "this sprint" mean something. */
export const aiPlanContextSchema = z.object({
  path: z.string().max(500).optional(),
  /** The issue or page open behind the palette, by key or id. */
  recordKey: z.string().max(80).optional(),
});
export type AiPlanContext = z.infer<typeof aiPlanContextSchema>;

/** POST /api/v1/ai/plans */
export const aiPlanCreateBodySchema = z.object({
  request: z.string().trim().min(1).max(2000),
  context: aiPlanContextSchema.optional(),
});
export type AiPlanCreateBody = z.infer<typeof aiPlanCreateBodySchema>;

/**
 * POST /api/v1/ai/plans/:id/run. `steps` is the edited plan: the indexes the person kept.
 * Omitted, every allowed step runs. A denied step is never run, even when named.
 */
export const aiPlanRunBodySchema = z.object({
  steps: z.array(z.number().int().nonnegative()).max(200).optional(),
});
export type AiPlanRunBody = z.infer<typeof aiPlanRunBodySchema>;

export const aiPlanIdParamsSchema = z.object({ id: z.uuid() });

/** The realtime kind a plan's progress is announced under, to its owner only. */
export const AI_PLAN_REALTIME_KIND = 'ai.plan';

/** Counts the palette's progress line reads: "3 of 5 changes made". */
export function aiPlanProgress(plan: Pick<AiPlan, 'steps'>) {
  const chosen = plan.steps.filter((step) => !['proposed', 'skipped'].includes(step.status));
  return {
    total: chosen.length,
    done: chosen.filter((step) => step.status === 'done' || step.status === 'undone').length,
    failed: chosen.filter((step) => step.status === 'failed').length,
    allowed: plan.steps.filter((step) => step.permission === 'ALLOWED').length,
    denied: plan.steps.filter((step) => step.permission === 'DENIED').length,
    undoable: plan.steps.filter((step) => step.undoable).length,
  };
}
