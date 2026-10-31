import { z } from 'zod';
import { connectionModeSchema } from './clouds.ts';
import { idSchema, slugSchema } from './common.ts';

/*
 * Platform › Export: everything Pipelines created, as Terraform and Helm a company can run
 * itself. GET /api/v1/pipelines/exports previews the bundle; GET /exports/archive downloads it
 * as a zip. Both take the same filters: one connection, or one application's services.
 */

export const exportQuerySchema = z.object({
  connection: idSchema.optional(),
  application: slugSchema.optional(),
});

/** What one connection's directory holds. */
export const exportConnectionSchema = z.object({
  connection: z.object({ id: idSchema, name: z.string(), mode: connectionModeSchema }),
  /** "acme-google-cloud": the directory inside the zip. */
  directory: z.string(),
  counts: z.object({
    projects: z.number().int(),
    resources: z.number().int(),
    services: z.number().int(),
    charts: z.number().int(),
    secrets: z.number().int(),
  }),
  /** Paths inside the zip, sorted. */
  files: z.array(z.string()),
  /** What was not exported and why, one sentence each. */
  leftOut: z.array(z.string()),
  /** Values Pipelines could not read, to fill in terraform.tfvars before a plan. */
  toFill: z.array(z.string()),
});

export const exportPreviewSchema = z.object({
  /** "bemmoly-pipelines-export-2026-10-29.zip". */
  fileName: z.string(),
  items: z.array(exportConnectionSchema),
  /** What no connection could export: services with no cloud, providers with no export. */
  leftOut: z.array(z.string()),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type ExportConnection = z.infer<typeof exportConnectionSchema>;
export type ExportPreview = z.infer<typeof exportPreviewSchema>;
