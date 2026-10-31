import { z } from 'zod';
import { slugSchema } from './common.ts';
import { deploySettingFieldSchema, deploySettingValueSchema } from './deploy-settings.ts';
import { environmentRefSchema } from './environments.ts';
import { variableNameSchema } from './variables.ts';

/*
 * Adopting the Cloud Run services an environment already runs, deployed by hand or by other
 * CI. GET /environments/:key/adoptions is the plan: every service in the environment's
 * project and region, the catalog application it matches by name, and what adopting it would
 * import. Reading it changes nothing in the cloud. POST /environments/:key/adoptions adopts
 * the services named: plain variables as they are, secrets as references to where they
 * already live at their pinned version, the scaling, resources, port and probes as that
 * environment's deploy settings, and the running image by digest as release zero.
 */

/** Why a service cannot be adopted as it stands, or that it already was. */
export const adoptionStateSchema = z.enum([
  /** It matches an application and can be adopted. */
  'ready',
  /** Pipelines adopted it before. */
  'adopted',
  /** Pipelines already deploys the application it matches here. */
  'deployed',
  /** No application in the catalog has its name; pick one, or skip it. */
  'unmatched',
]);

export const adoptedVariableSchema = z.discriminatedUnion('kind', [
  z.object({
    name: variableNameSchema,
    kind: z.literal('plain'),
    value: z.string(),
    /**
     * When the value holds another service's address and that service is adopted too: the
     * application it names, and the value with `${{ apps.<key>.url }}` in place of the address.
     */
    reference: z.object({ application: slugSchema, value: z.string() }).nullable(),
  }),
  z.object({
    name: variableNameSchema,
    kind: z.literal('secret'),
    /** "acme-stage / cart-db-password": where the value lives; it is never read. */
    location: z.string(),
    version: z.string(),
    /** Why it cannot be referenced from Pipelines, in one sentence; null when it can. */
    problem: z.string().nullable(),
  }),
]);

export const adoptionServiceSchema = z.object({
  /** The service's name in the cloud. */
  service: z.string(),
  url: z.string().nullable(),
  /** The application it matches by name, or was adopted as. */
  application: z.object({ key: slugSchema, name: z.string() }).nullable(),
  state: adoptionStateSchema,
  /** The image it runs, by digest: what release zero records. */
  image: z.string().nullable(),
  revision: z.string().nullable(),
  variables: z.array(adoptedVariableSchema),
  settings: z.array(z.object({ field: deploySettingFieldSchema, value: deploySettingValueSchema })),
  /** Why it cannot be adopted, in one sentence; null when it can. */
  problem: z.string().nullable(),
});

export const adoptionPlanSchema = z.object({
  environment: environmentRefSchema,
  /** Where the services were looked for. */
  project: z.string(),
  region: z.string(),
  services: z.array(adoptionServiceSchema),
  /** The catalog, for matching a service to an application of another name. */
  applications: z.array(z.object({ key: slugSchema, name: z.string() })),
});

export const adoptBodySchema = z.object({
  services: z
    .array(
      z.object({
        service: z.string().min(1).max(63),
        application: slugSchema,
        /** Plain variables whose address becomes a reference to the application it names. */
        references: z.array(variableNameSchema).default([]),
      }),
    )
    .min(1, 'Choose at least one service to adopt'),
});

export const adoptResultSchema = z.object({
  adopted: z.array(
    z.object({
      service: z.string(),
      application: slugSchema,
      release: z.object({ id: z.string(), version: z.string() }),
    }),
  ),
  plan: adoptionPlanSchema,
});

export type AdoptionState = z.infer<typeof adoptionStateSchema>;
export type AdoptedVariable = z.infer<typeof adoptedVariableSchema>;
export type AdoptionService = z.infer<typeof adoptionServiceSchema>;
export type AdoptionPlan = z.infer<typeof adoptionPlanSchema>;
export type AdoptBody = z.input<typeof adoptBodySchema>;
export type AdoptResult = z.infer<typeof adoptResultSchema>;
