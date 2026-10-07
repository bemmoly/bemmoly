import { z } from 'zod';

export const healthCheckStatusSchema = z.enum(['ok', 'warning', 'failed']);

/** One probe on Settings › System and the wizard's first step (Postgres, disk, SMTP, …). */
export const healthCheckSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: healthCheckStatusSchema,
  detail: z.string(),
  fix: z.object({ label: z.string(), href: z.string() }).optional(),
});

export type HealthCheckStatus = z.infer<typeof healthCheckStatusSchema>;
export type HealthCheck = z.infer<typeof healthCheckSchema>;
