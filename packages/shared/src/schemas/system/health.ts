import { z } from 'zod';

export const SYSTEM_CHECK_IDS = ['postgres', 'disk', 'memory', 'smtp', 'https', 'backups'] as const;

export const systemCheckSchema = z.object({
  id: z.enum(SYSTEM_CHECK_IDS),
  /** Row label in the Setup mock, e.g. "Postgres 18". */
  name: z.string(),
  status: z.enum(['ok', 'warn', 'fail']),
  /** Monospace value column, e.g. "db:5432 · 12 ms". */
  value: z.string(),
  fix: z
    .object({
      label: z.string(),
      hint: z.string(),
      /** In-app settings path when the fix is a settings page. */
      href: z.string().optional(),
    })
    .nullable(),
});

/** GET /api/v1/admin/system: the wizard's step-1 checks and the System page. */
export const systemHealthResponseSchema = z.object({
  version: z.string(),
  role: z.enum(['all', 'api', 'worker']),
  uptimeSeconds: z.number().int().nonnegative(),
  maintenance: z.object({ active: z.boolean(), reason: z.string().nullable() }),
  checks: z.array(systemCheckSchema),
});

export type SystemCheckId = (typeof SYSTEM_CHECK_IDS)[number];
export type SystemCheck = z.infer<typeof systemCheckSchema>;
export type SystemHealthResponse = z.infer<typeof systemHealthResponseSchema>;
