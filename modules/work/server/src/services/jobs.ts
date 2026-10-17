/*
 * Job names the Work module owns. Handlers live beside the service that does
 * the work; the names are here so module.ts and tests share one spelling.
 */

/** Rewrites the lexorank of a project's issues when ranks grow long. */
export const WORK_RANK_REBALANCE_JOB = 'work.rank.rebalance';

/** Runs one queued automation run, or a workflow post-action's rule for an issue. */
export const WORK_AUTOMATION_RUN_JOB = 'work.automation.run';

/** Every minute: queues a run for each scheduled rule whose time came. */
export const WORK_AUTOMATION_SCHEDULE_JOB = 'work.automation.schedule';

/** Deletes the issues of a project too large to delete in one transaction, then the project. */
export const WORK_PROJECT_PURGE_JOB = 'work.project.purge';
