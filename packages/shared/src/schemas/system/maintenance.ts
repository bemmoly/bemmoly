import { z } from 'zod';

/**
 * <data>/maintenance.json, written by the app during a restore and by the updater
 * during an update or rollback. While it exists the app refuses writes and both serve
 * the same message.
 */
export const MAINTENANCE_FILE = 'maintenance.json';

export const maintenanceStateSchema = z.object({
  reason: z.enum(['restore', 'update', 'rollback']),
  message: z.string(),
  step: z.string().nullable(),
  startedAt: z.iso.datetime(),
});

export type MaintenanceState = z.infer<typeof maintenanceStateSchema>;
