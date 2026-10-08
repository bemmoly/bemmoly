/*
 * Job names the Work module owns. Handlers live beside the service that does
 * the work; the names are here so module.ts and tests share one spelling.
 */

/** Rewrites the lexorank of a project's issues when ranks grow long. */
export const WORK_RANK_REBALANCE_JOB = 'work.rank.rebalance';

/** Runs one automation rule for an issue; the engine arrives in a later release. */
export const WORK_AUTOMATION_RUN_JOB = 'work.automation.run';
