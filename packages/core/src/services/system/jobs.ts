import type { JobDefinition } from '../../modules/registries.ts';
import { BACKUP_DRILL_JOB, BACKUP_JOB, handleBackupJob } from './backups/jobs.ts';
import { BACKUP_TICK_CRON } from './backups/schedule.ts';
import { runScheduledDrill } from './backups/verify.ts';
import type { SystemDependencies } from './deps.ts';
import { checkForUpdates, UPDATE_CHECK_CRON, UPDATE_CHECK_JOB } from './updates/check.ts';

export const SYSTEM_JOBS = {
  backup: BACKUP_JOB,
  backupDrill: BACKUP_DRILL_JOB,
  updateCheck: UPDATE_CHECK_JOB,
} as const;

/**
 * The kernel's system jobs, for the worker role. Handlers are thin: they parse the
 * payload and call a service.
 */
export function systemJobs(deps: SystemDependencies): JobDefinition[] {
  return [
    {
      name: BACKUP_JOB,
      schedule: BACKUP_TICK_CRON,
      retryLimit: 0,
      handle: async (payload) => {
        await handleBackupJob(deps, payload);
      },
    },
    {
      name: BACKUP_DRILL_JOB,
      schedule: '30 3 * * *',
      retryLimit: 0,
      handle: async () => {
        await runScheduledDrill(deps);
      },
    },
    {
      name: UPDATE_CHECK_JOB,
      schedule: UPDATE_CHECK_CRON,
      retryLimit: 2,
      handle: async () => {
        await checkForUpdates(deps);
      },
    },
  ];
}
