import { z } from 'zod';
import { isoDateTimeSchema, personRefSchema, slugSchema } from './common.ts';
import { environmentRefSchema } from './environments.ts';
import { resolvedValueSchema } from './app-references.ts';

/*
 * An application's variables and secrets, for every environment or one:
 * GET /applications/:key/variables, PUT and DELETE /applications/:key/variables/:name, with
 * ?environment=<key> naming one environment and its absence meaning all of them. A plain
 * variable's value is stored and shown. A secret's value goes straight to the cloud's secret
 * store; Pipelines keeps where it lives and its version, and never answers with a value.
 */

export const variableNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Z_][A-Z0-9_]{0,127}$/, 'Use capitals, digits and underscores, such as DATABASE_URL');

export const variableKindSchema = z.enum(['plain', 'secret']);

/** Cloud Run takes at most 32 KiB in one variable; Secret Manager takes 64 KiB. */
export const VARIABLE_VALUE_MAX = 32_768;

export const variableSchema = z.object({
  name: variableNameSchema,
  kind: variableKindSchema,
  /** Null for a value every environment gets unless it has its own. */
  environment: environmentRefSchema.nullable(),
  /** A plain variable's value. Always null for a secret. */
  value: z.string().nullable(),
  /** A secret's version in the store; for a plain variable, how many times it was set. */
  version: z.number().int().nullable(),
  /** "moving": a value from before secrets existed, waiting to be written to the store. */
  state: z.enum(['set', 'moving']),
  /** What stops it moving or mounting, in one sentence; null when nothing does. */
  problem: z.string().nullable(),
  /** Where a secret lives: "acme-shop-prod / bemmoly-shop-API_KEY-prod". */
  location: z.string().nullable(),
  updatedBy: personRefSchema.nullable(),
  updatedAt: isoDateTimeSchema,
  /**
   * A plain value naming other applications' addresses, filled in per environment it reaches
   * (shared/app-references.ts). Empty when the value names none.
   */
  resolved: z.array(resolvedValueSchema).default([]),
});

export const variablesResponseSchema = z.object({
  items: z.array(variableSchema),
  /** The columns to lay values out under, left to right. */
  environments: z.array(environmentRefSchema),
  /** Whether the person asking may set values for every environment. */
  canChange: z.boolean(),
});

export const variableListQuerySchema = z.object({ environment: slugSchema.optional() });

export const variableParamsSchema = z.object({ key: slugSchema, name: variableNameSchema });

export const variableTargetQuerySchema = z.object({ environment: slugSchema.optional() });

export const setVariableBodySchema = z.object({
  kind: variableKindSchema,
  value: z.string().min(1, 'Give it a value').max(VARIABLE_VALUE_MAX),
});

export type VariableKind = z.infer<typeof variableKindSchema>;
export type Variable = z.infer<typeof variableSchema>;
export type VariablesResponse = z.infer<typeof variablesResponseSchema>;
export type SetVariableBody = z.infer<typeof setVariableBodySchema>;
