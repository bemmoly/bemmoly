import { z } from 'zod';
import { idSchema } from './common.ts';
import { registryPathSchema } from './clouds.ts';

/*
 * Attached projects and the image registry (journeys proposal, "How much Pipelines controls"):
 * POST /clouds/:id/accounts attaches a project that already exists, POST
 * /clouds/:id/accounts/:accountId/check runs its checks again, DELETE detaches it, and
 * PATCH /clouds/:id sets where runners push images and which project holds CI secrets.
 */

/** A Google Cloud project id: 6 to 30 lowercase letters, digits and hyphens. */
export const projectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/, 'Use the project ID, such as acme-prod-421309');

const serviceAccountSchema = z
  .email()
  .refine((value) => value.endsWith('.gserviceaccount.com'), 'Name a service account email');

export const attachAccountBodySchema = z.object({
  externalId: projectIdSchema,
  /** Shown on screen; the project's own name when left out. */
  name: z.string().trim().min(1).max(80).optional(),
  /** Pipelines acts as this account to deploy; it acts as itself when left out. */
  deployerServiceAccount: serviceAccountSchema.nullable().default(null),
  /** Services run as this account; the project's default when left out. */
  runtimeServiceAccount: serviceAccountSchema.nullable().default(null),
});

/** Only what is sent changes; no field has a default. */
export const updateConnectionBodySchema = z
  .object({
    /** Null stops pushing: runners keep the images they build. */
    registry: registryPathSchema.nullable(),
    /**
     * The attached project that holds CI secrets and secrets set for every environment. Null
     * clears it. A managed connection keeps them in its own CI project instead.
     */
    ciAccountId: idSchema.nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Change at least one thing');

export const accountParamsSchema = z.object({ id: idSchema, accountId: idSchema });

export type AttachAccountBody = z.input<typeof attachAccountBodySchema>;
export type UpdateConnectionBody = z.input<typeof updateConnectionBodySchema>;
