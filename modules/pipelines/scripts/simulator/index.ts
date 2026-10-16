import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import { createRng } from '../demo/rng.ts';
import { finishJobRows, releaseRows, startJobRows, startRunRows } from './execute-runs.ts';
import { executeShipping } from './execute-ship.ts';
import { loadCatalog, loadState } from './load.ts';
import type { Action, SimCatalog, SimLimits, SimState } from './model.ts';
import { createPlanner } from './plan.ts';

export type { Action } from './model.ts';

/*
 * The demo simulator: one action per tick, each in its own transaction, planned in memory
 * and written through the same functions the real services use, so every open screen hears
 * the same events it would hear from runners and the shipping engine.
 */

export interface SimulatorOptions {
  seed: number;
  /** Overrides for how much moves at once; the default follows what the seed left running. */
  limits?: Partial<SimLimits>;
  /** The clock; tests pass a fake one. */
  now?: () => Date;
}

/** Marks an action the database refused because someone else moved its rows. */
class Stale extends Error {}

async function apply(tx: SqlExecutor, catalog: SimCatalog, action: Action, now: Date) {
  switch (action.kind) {
    case 'idle':
      return true;
    case 'run.start':
      return startRunRows(tx, catalog, action);
    case 'job.start':
      return startJobRows(tx, action);
    case 'job.finish':
      if (!(await finishJobRows(tx, catalog, action))) return false;
      if (await releaseRows(tx, catalog, action)) await executeShipping(tx, action, now);
      return true;
    default:
      return executeShipping(tx, action, now);
  }
}

export async function createSimulator(sql: SqlClient, options: SimulatorOptions) {
  const clock = options.now ?? (() => new Date());
  const catalog = await loadCatalog(sql);
  if (catalog.apps.length === 0 || catalog.envs.length === 0) {
    throw new Error('There is no catalog to simulate. Seed the demo first.');
  }
  const state: SimState = await loadState(
    sql,
    catalog,
    createRng(options.seed ^ 0x5eed),
    clock().getTime(),
  );
  const limits: SimLimits = {
    runs: Math.min(150, Math.max(8, state.runs.length)),
    promotions: 6,
    deployments: 24,
    ...options.limits,
  };
  const planner = createPlanner(catalog, options.seed, limits);

  return {
    catalog,
    state,
    limits,
    /** Plans and writes the next action; one the database refused is forgotten. */
    async tick(): Promise<{ action: Action; applied: boolean; error?: unknown }> {
      const now = clock();
      const action = planner.next(state, now.getTime());
      if (action.kind === 'idle') return { action, applied: true };
      try {
        await sql.begin(async (tx) => {
          if (!(await apply(tx, catalog, action, now))) throw new Stale();
        });
        return { action, applied: true };
      } catch (error) {
        // Whatever went wrong, the rows are as they were: stop tracking them and go on.
        planner.forget(state, action);
        return { action, applied: false, ...(error instanceof Stale ? {} : { error }) };
      }
    },
  };
}

export type Simulator = Awaited<ReturnType<typeof createSimulator>>;

/** One line per action for the terminal, in the product's words. */
export function describe(action: Action, catalog: SimCatalog): string {
  const app = (id: string) => catalog.apps.find((a) => a.id === id)?.key ?? 'an application';
  const env = (id: string) => catalog.envs.find((e) => e.id === id)?.key ?? 'an environment';
  switch (action.kind) {
    case 'idle':
      return 'nothing due';
    case 'run.start':
      return `run started on ${app(action.run.appId)}: ${action.title}`;
    case 'job.start':
      return `${app(action.appId)}: ${action.jobName} running`;
    case 'job.finish':
      return action.release
        ? `${app(action.appId)}: run passed, ${action.release.version} released`
        : `${app(action.appId)}: ${action.jobName} ${action.passed ? 'passed' : 'failed'}`;
    case 'deployment.start':
      return `deploy ${app(action.deployment.appId)} ${action.deployment.version} to ${env(action.deployment.envId)}`;
    case 'deployment.step': {
      const what = `${app(action.appId)} ${action.version} in ${env(action.envId)}`;
      const how = action.state === 'canary' ? `canary at ${action.traffic}%` : action.state;
      return `${what}: ${how.replace('_', ' ')}`;
    }
    case 'promotion.request':
      return `approval asked: ${app(action.promotion.appId)} ${action.promotion.version} to Prod`;
    case 'promotion.approve':
      return 'promotion approved; canary starts';
    case 'promotion.wave':
      return `promotion wave ${action.wave} starts`;
    case 'promotion.finish':
      return `promotion ${action.outcome.replace('_', ' ')}`;
  }
}
