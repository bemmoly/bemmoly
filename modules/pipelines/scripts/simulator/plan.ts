import { createRng, type Rng } from '../demo/rng.ts';
import type { Action, SimApp, SimCatalog, SimLimits, SimState } from './model.ts';
import { advanceJob, SECOND, startRun } from './plan-runs.ts';
import {
  advanceDeployment,
  advancePromotion,
  moveOn,
  newDeployment,
  type ShipContext,
} from './plan-ship.ts';

/*
 * The simulator's brain, with no database: given what is moving and the time, it picks the
 * one thing to do next and updates its picture as if that already happened. Everything
 * random comes from one seeded generator and everything due is taken oldest first, so the
 * same seed, catalog and clock always give the same actions.
 */

export interface Planner {
  next(state: SimState, now: number): Action;
  /** The database disagreed (someone else moved it): stop tracking what the action named. */
  forget(state: SimState, action: Action): void;
}

/** A new run every couple of seconds at most, so a burst never floods the Runs list. */
const RUN_GAP = 2 * SECOND;

function picker(apps: readonly SimApp[], rng: Rng) {
  const live = apps.filter((a) => a.weight > 0);
  const total = live.reduce((sum, a) => sum + a.weight, 0);
  return (): SimApp | null => {
    let roll = rng.next() * total;
    for (const app of live) {
      roll -= app.weight;
      if (roll < 0) return app;
    }
    return live[live.length - 1] ?? null;
  };
}

type Due =
  | { at: number; id: string; kind: 'job'; runIndex: number; jobIndex: number }
  | { at: number; id: string; kind: 'deployment' | 'promotion' | 'landed'; index: number };

function dueItems(state: SimState, now: number): Due[] {
  const due: Due[] = [];
  state.runs.forEach((run, runIndex) =>
    run.jobs.forEach((job, jobIndex) => {
      if ((job.state === 'ready' || job.state === 'running') && job.dueAt <= now)
        due.push({ at: job.dueAt, id: job.id, kind: 'job', runIndex, jobIndex });
    }),
  );
  state.deployments.forEach((d, index) => {
    if (d.dueAt <= now) due.push({ at: d.dueAt, id: d.id, kind: 'deployment', index });
  });
  state.promotions.forEach((p, index) => {
    if (p.dueAt <= now) due.push({ at: p.dueAt, id: p.id, kind: 'promotion', index });
  });
  state.landed.forEach((l, index) => {
    if (l.dueAt <= now) due.push({ at: l.dueAt, id: l.releaseId, kind: 'landed', index });
  });
  return due.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function createPlanner(catalog: SimCatalog, seed: number, limits: SimLimits): Planner {
  const rng = createRng(seed);
  const pick = picker(catalog.apps, rng);
  const dev = catalog.envs[0];

  function take(state: SimState, item: Due, now: number): Action | null {
    const ctx: ShipContext = { state, catalog, limits, rng, now };
    if (item.kind === 'job') {
      const run = state.runs[item.runIndex];
      const job = run?.jobs[item.jobIndex];
      if (!run || !job) return null;
      return advanceJob(state, catalog, run, job, rng, now, (app, releaseId, version) =>
        dev ? newDeployment(ctx, app, dev, { id: releaseId, version }) : null,
      );
    }
    if (item.kind === 'deployment') {
      const d = state.deployments[item.index];
      return d ? advanceDeployment(ctx, d) : null;
    }
    if (item.kind === 'promotion') {
      const p = state.promotions[item.index];
      return p ? advancePromotion(ctx, p) : null;
    }
    const landed = state.landed[item.index];
    return landed ? moveOn(ctx, landed) : null;
  }

  return {
    next(state, now) {
      const canStart = state.runs.length < limits.runs && now - state.lastRunAt >= RUN_GAP;
      let due = dueItems(state, now);
      if (canStart && (due.length === 0 || rng.chance(0.25))) {
        const app = pick();
        if (app) {
          const action = startRun(catalog, app, rng, now);
          if (action.kind === 'run.start') state.runs.push(action.run);
          state.lastRunAt = now;
          return action;
        }
      }
      // A landed release may decide to stay where it is; then the next due thing goes.
      while (due.length > 0) {
        const [first] = due;
        if (!first) break;
        const action = take(state, first, now);
        if (action) return action;
        due = dueItems(state, now);
      }
      return { kind: 'idle' };
    },

    forget(state, action) {
      const dropPromotion = (id: string) => {
        state.promotions = state.promotions.filter((p) => p.id !== id);
        state.deployments = state.deployments.filter((d) => d.promotionId !== id);
      };
      switch (action.kind) {
        case 'run.start':
          state.runs = state.runs.filter((r) => r.id !== action.run.id);
          break;
        case 'job.start':
        case 'job.finish':
          state.runs = state.runs.filter((r) => r.id !== action.runId);
          if (action.kind === 'job.finish' && action.deployment) {
            const id = action.deployment.id;
            state.deployments = state.deployments.filter((d) => d.id !== id);
          }
          break;
        case 'deployment.start':
        case 'deployment.step': {
          const id =
            action.kind === 'deployment.start' ? action.deployment.id : action.deploymentId;
          const found = state.deployments.find((d) => d.id === id);
          state.deployments = state.deployments.filter((d) => d.id !== id);
          if (found?.promotionId) dropPromotion(found.promotionId);
          break;
        }
        case 'promotion.request':
          dropPromotion(action.promotion.id);
          break;
        case 'promotion.approve':
        case 'promotion.wave':
        case 'promotion.finish':
          dropPromotion(action.promotionId);
          break;
        case 'idle':
          break;
      }
    },
  };
}
