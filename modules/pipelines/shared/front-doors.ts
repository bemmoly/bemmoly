import { z } from 'zod';
import { deployRuntimeSchema, idSchema, isoDateTimeSchema, slugSchema } from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * The front door (journeys proposal, "Switch any time"): a stable address per environment
 * and a host per application on it, so moving an application between runtimes is a traffic
 * shift with no downtime. GET /front-doors lists them (?application= keeps that one's
 * routes); PUT /environments/:key/front-door turns one on or off and names its domain. A new
 * Prod environment has one on from the start; others turn it on here.
 *
 * With a domain, each application answers on https://<application>.<domain> once Google has
 * issued its certificate, which needs DNS pointing at the address. Without one, it answers on
 * http://<address> with the application's key as the Host header.
 */

export const frontDoorStatusSchema = z.enum(['pending', 'applying', 'ready', 'failed', 'off']);

export const frontDoorDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(?=.{4,200}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    'Name a domain such as prod.example.com',
  );

/** One share of a host's traffic: a runtime, and on GKE the revision. */
export const frontDoorBackendSchema = z.object({
  runtime: deployRuntimeSchema,
  /** Null sends the share to the runtime's own split (Cloud Run's revisions). */
  revision: z.string().nullable(),
  percent: z.number().int().min(0).max(100),
});

export const frontDoorRouteSchema = z.object({
  application: z.object({ key: slugSchema, name: z.string() }),
  /** The project it is served from. */
  account: z.string(),
  host: z.string(),
  /** Where a person calls it. */
  url: z.string().nullable(),
  backends: z.array(frontDoorBackendSchema),
});

export const frontDoorSchema = z.object({
  id: idSchema,
  environment: environmentRefSchema,
  enabled: z.boolean(),
  domain: z.string().nullable(),
  status: frontDoorStatusSchema,
  /** The address reserved in each project the environment's applications run in. */
  addresses: z.array(z.object({ account: z.string(), address: z.string() })),
  /** What stops a host answering, each one sentence saying what to do. */
  problems: z.array(z.string()),
  routes: z.array(frontDoorRouteSchema),
  appliedAt: isoDateTimeSchema.nullable(),
});

export const frontDoorsResponseSchema = z.object({ items: z.array(frontDoorSchema) });

export const frontDoorsQuerySchema = z.object({ application: slugSchema.optional() });

export const setFrontDoorBodySchema = z.object({
  enabled: z.boolean(),
  domain: frontDoorDomainSchema.nullable().default(null),
});

export type FrontDoorStatus = z.infer<typeof frontDoorStatusSchema>;
export type FrontDoorBackendShare = z.infer<typeof frontDoorBackendSchema>;
export type FrontDoorRoute = z.infer<typeof frontDoorRouteSchema>;
export type FrontDoor = z.infer<typeof frontDoorSchema>;
export type FrontDoorsResponse = z.infer<typeof frontDoorsResponseSchema>;
export type SetFrontDoorBody = z.infer<typeof setFrontDoorBodySchema>;
