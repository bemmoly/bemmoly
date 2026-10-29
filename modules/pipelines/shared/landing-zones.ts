import { z } from 'zod';
import { idSchema, slugSchema } from './common.ts';
import { layoutSchema } from './clouds.ts';

/*
 * The landing zone preview and apply (architecture §14): POST /clouds/:id/plan builds a plan
 * from what Pipelines recorded, POST /clouds/:id/apply queues it, and GET
 * /clouds/:id/plans/:planId says how the apply is going. Nothing is created until Apply, and
 * nothing is ever deleted: projects a new layout no longer needs are kept.
 */

export const landingZoneNodeKindSchema = z.enum(['folder', 'account', 'resource']);

/** "kept": no longer in the layout; Pipelines leaves it as it is and never deletes it. */
export const landingZoneNodeStatusSchema = z.enum([
  'exists',
  'create',
  'update',
  'drifted',
  'kept',
]);

export interface LandingZoneNode {
  kind: z.infer<typeof landingZoneNodeKindSchema>;
  name: string;
  note: string | null;
  status: z.infer<typeof landingZoneNodeStatusSchema>;
  children: LandingZoneNode[];
}

/** The preview tree: what will be created, folder by folder and project by project. */
export const landingZoneNodeSchema: z.ZodType<LandingZoneNode> = z.lazy(() =>
  z.object({
    kind: landingZoneNodeKindSchema,
    name: z.string(),
    /** "runners, registry, caches", "3 regions". */
    note: z.string().nullable(),
    status: landingZoneNodeStatusSchema,
    children: z.array(landingZoneNodeSchema),
  }),
);

export const landingZonePlanBodySchema = z.object({
  layout: layoutSchema.optional(),
  environments: z.array(slugSchema).min(1).optional(),
});

export const planStatusSchema = z.enum(['planned', 'applying', 'applied', 'failed', 'superseded']);

export const planBillingSchema = z.object({
  /** "01A2B3-C4D5E6-F7A8B9". */
  account: z.string(),
  /** Projects the account pays for now. */
  linked: z.number().int(),
  /** Projects this plan creates and links to it. */
  adding: z.number().int(),
  /** The limit compared against: one an admin recorded, or the usual default for new accounts. */
  limit: z.number().int(),
  /** True when an admin recorded the limit; false when it is the usual default, unconfirmed. */
  recorded: z.boolean(),
});

export const landingZonePlanSchema = z.object({
  planId: idSchema,
  connectionId: idSchema,
  layout: layoutSchema,
  root: landingZoneNodeSchema,
  /** "27 projects · 1 folder per domain". */
  counts: z.object({
    folders: z.number().int(),
    accounts: z.number().int(),
    resources: z.number().int(),
  }),
  /** Quota or permission problems found before planning; Apply stays off while any exist. */
  blockers: z.array(z.string()),
  /** What to know before Apply that does not stop it: moves, kept projects, billing headroom. */
  warnings: z.array(z.string()),
  /** The billing account's projects now and what this plan adds; null where nothing is billed. */
  billing: planBillingSchema.nullable(),
  status: planStatusSchema,
  /** Why the last apply stopped, in one sentence; null unless it failed. */
  lastError: z.string().nullable(),
  specHash: z.string(),
});

export const applyLandingZoneBodySchema = z.object({
  planId: idSchema,
  /** The hash the person saw, so a changed plan cannot be applied unseen. */
  specHash: z.string().min(1),
});

export const planParamsSchema = z.object({ id: idSchema, planId: idSchema });

export type LandingZonePlanBody = z.infer<typeof landingZonePlanBodySchema>;
export type LandingZonePlan = z.infer<typeof landingZonePlanSchema>;
export type PlanBilling = z.infer<typeof planBillingSchema>;
export type ApplyLandingZoneBody = z.infer<typeof applyLandingZoneBodySchema>;
