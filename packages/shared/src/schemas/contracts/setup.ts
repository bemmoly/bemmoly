import { z } from 'zod';
import { passwordSchema } from './common.ts';

export const setupStateSchema = z.enum(['needs_admin', 'in_progress', 'complete']);

export const healthCheckStatusSchema = z.enum(['ok', 'warning', 'failed']);

/** One probe from the wizard's first step and Settings › System (Postgres, disk, SMTP, …). */
export const healthCheckSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: healthCheckStatusSchema,
  detail: z.string(),
  fix: z.object({ label: z.string(), href: z.string() }).optional(),
});

/**
 * Anonymous by design. `checks` is filled only while no admin exists, so a
 * finished install never tells an anonymous caller about its disks.
 */
export const setupStatusSchema = z.object({
  state: setupStateSchema,
  version: z.string().min(1),
  workspace: z.object({ name: z.string(), url: z.string() }).nullable(),
  checks: z.array(healthCheckSchema),
});

export const createAdminRequestSchema = z.object({
  workspaceName: z.string().trim().min(1, 'Name the workspace').max(80),
  workspaceUrl: z.string().trim().min(1),
  name: z.string().trim().min(1, 'Enter your name').max(120),
  email: z.email('Enter a valid email address'),
  password: passwordSchema,
});

export type SetupState = z.infer<typeof setupStateSchema>;
export type HealthCheckStatus = z.infer<typeof healthCheckStatusSchema>;
export type HealthCheck = z.infer<typeof healthCheckSchema>;
export type SetupStatus = z.infer<typeof setupStatusSchema>;
export type CreateAdminRequest = z.infer<typeof createAdminRequestSchema>;
