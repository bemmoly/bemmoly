import { uuidv7, type Rng } from '../demo/rng.ts';
import type {
  Action,
  DeploymentStep,
  Landed,
  SimApp,
  SimCatalog,
  SimDeployment,
  SimEnv,
  SimLimits,
  SimPromotion,
  SimState,
} from './model.ts';
import { authorFor, SECOND } from './plan-runs.ts';

/*
 * Shipping, planned in memory: a release lands in Dev, some move on to Staging, some of
 * those ask to go to Prod. A Prod promotion waits for an approval, rolls out to the first
 * region as a canary (5%, 25%, 100%), then to the other regions at once. Now and then a
 * deploy fails or a canary rolls back, and the promotion ends there.
 */

const between = (rng: Rng, low: number, high: number) => rng.int(low, high) * SECOND;
const CANARY = [5, 25, 100];

export interface ShipContext {
  state: SimState;
  catalog: SimCatalog;
  limits: SimLimits;
  rng: Rng;
  now: number;
}

const envIndex = (catalog: SimCatalog, envId: string) =>
  catalog.envs.findIndex((e) => e.id === envId);

const prodEnvs = (catalog: SimCatalog) => catalog.envs.filter((e) => e.class === 'prod');

function busy(state: SimState, appId: string, envId: string): boolean {
  return state.deployments.some((d) => d.appId === appId && d.envId === envId);
}

export function newDeployment(
  ctx: ShipContext,
  app: SimApp,
  env: SimEnv,
  release: { id: string; version: string },
  options: { promotionId?: string; canary?: boolean; failRate?: number } = {},
): SimDeployment | null {
  const { state, limits, rng, now } = ctx;
  if (busy(state, app.id, env.id) || state.deployments.length >= limits.deployments) return null;
  const steps = options.canary ? [...CANARY] : [];
  const fails = rng.chance(options.failRate ?? 0.04);
  const deployment: SimDeployment = {
    id: uuidv7(rng, now),
    appId: app.id,
    envId: env.id,
    releaseId: release.id,
    version: release.version,
    promotionId: options.promotionId ?? null,
    state: 'pending',
    traffic: 0,
    steps,
    failAt: fails ? (steps.length > 0 ? rng.pick(steps.slice(0, 2)) : 0) : null,
    dueAt: now + between(rng, 3, 8),
  };
  state.deployments.push(deployment);
  return deployment;
}

/** The next step of one due deployment. */
export function advanceDeployment(ctx: ShipContext, d: SimDeployment): Action {
  const { state, catalog, rng, now } = ctx;
  const step = (state: DeploymentStep, traffic: number, message: string): Action => ({
    kind: 'deployment.step',
    deploymentId: d.id,
    appId: d.appId,
    envId: d.envId,
    version: d.version,
    state,
    traffic,
    message,
  });
  if (d.state === 'pending') {
    d.state = 'deploying';
    d.dueAt = now + between(rng, 15, 35);
    return step('deploying', 0, `Deploying ${d.version}`);
  }
  const end = (outcome: 'succeeded' | 'failed' | 'rolled_back', message: string): Action => {
    state.deployments = state.deployments.filter((x) => x !== d);
    const promotion = state.promotions.find((p) => p.id === d.promotionId);
    if (promotion) {
      if (outcome !== 'succeeded') promotion.outcome = outcome;
      if (!state.deployments.some((x) => x.promotionId === promotion.id)) {
        promotion.dueAt = now + between(rng, 2, 6);
      }
    }
    const index = envIndex(catalog, d.envId);
    const env = catalog.envs[index];
    if (outcome === 'succeeded' && env && env.class !== 'prod') {
      state.landed.push({
        appId: d.appId,
        releaseId: d.releaseId,
        version: d.version,
        envIndex: index,
        dueAt: now + between(rng, 20, 60),
      });
    }
    return step(outcome, outcome === 'succeeded' ? 100 : 0, message);
  };
  if (d.state === 'deploying' && d.failAt === 0) {
    return end('failed', 'The new revision did not become healthy in 5 minutes');
  }
  if (d.state === 'canary' && d.failAt === d.traffic) {
    return end('rolled_back', 'Error rate 2.4% against 0.3% on the stable revision');
  }
  const next = d.steps.shift();
  if (next === undefined || next >= 100) return end('succeeded', `${d.version} is live`);
  d.state = 'canary';
  d.traffic = next;
  d.dueAt = now + between(rng, 20, 40);
  return step('canary', next, `Canary at ${next}%`);
}

/** A release that landed: Dev moves on to Staging, Staging asks to go to Prod. */
export function moveOn(ctx: ShipContext, landed: Landed): Action | null {
  const { state, catalog, limits, rng, now } = ctx;
  state.landed = state.landed.filter((l) => l !== landed);
  const app = catalog.apps.find((a) => a.id === landed.appId);
  const next = catalog.envs[landed.envIndex + 1];
  if (!app || !next) return null;
  const release = { id: landed.releaseId, version: landed.version };
  if (next.class !== 'prod') {
    if (!rng.chance(0.7)) return null;
    const deployment = newDeployment(ctx, app, next, release, { failRate: 0.05 });
    return deployment
      ? { kind: 'deployment.start', deployment, startedBy: authorFor(catalog, app, rng) }
      : null;
  }
  const open = state.promotions.some((p) => p.appId === app.id);
  if (open || state.promotions.length >= limits.promotions || !rng.chance(0.6)) return null;
  const mine = catalog.demoId !== null && app.members.includes(catalog.demoId);
  const promotion: SimPromotion = {
    id: uuidv7(rng, now),
    appId: app.id,
    releaseId: release.id,
    version: release.version,
    state: 'awaiting_approval',
    wave: 0,
    outcome: null,
    // Approvals the demo person may give wait longer, so there is time to give them.
    dueAt: now + (mine ? between(rng, 240, 480) : between(rng, 60, 150)),
  };
  state.promotions.push(promotion);
  const requester = app.members.filter((id) => id !== catalog.demoId);
  return {
    kind: 'promotion.request',
    promotion,
    requestedBy: requester.length > 0 ? rng.pick(requester) : null,
    deployments: [],
  };
}

function wave(ctx: ShipContext, promotion: SimPromotion, number: number): SimDeployment[] {
  const app = ctx.catalog.apps.find((a) => a.id === promotion.appId);
  const prod = prodEnvs(ctx.catalog);
  const targets = number === 1 ? prod.slice(0, 1) : prod.slice(1);
  if (!app) return [];
  const release = { id: promotion.releaseId, version: promotion.version };
  return targets
    .map((env) =>
      newDeployment(ctx, app, env, release, {
        promotionId: promotion.id,
        canary: number === 1,
        failRate: number === 1 ? 0.1 : 0.03,
      }),
    )
    .filter((d): d is SimDeployment => d !== null);
}

/** The regions are busy or the deployment cap is reached: try again in a little while. */
function later(ctx: ShipContext, promotion: SimPromotion): Action {
  promotion.dueAt = ctx.now + between(ctx.rng, 10, 20);
  return { kind: 'idle' };
}

/** One due promotion: approved, its next wave, or its end. */
export function advancePromotion(ctx: ShipContext, promotion: SimPromotion): Action {
  const { state, catalog, rng } = ctx;
  promotion.dueAt = Number.POSITIVE_INFINITY;
  const finish = (outcome: 'succeeded' | 'failed' | 'rolled_back', reason: string): Action => {
    state.promotions = state.promotions.filter((p) => p !== promotion);
    return { kind: 'promotion.finish', promotionId: promotion.id, outcome, reason };
  };
  if (promotion.state === 'awaiting_approval') {
    const app = catalog.apps.find((a) => a.id === promotion.appId);
    const approvers = (app?.members ?? []).filter((id) => id !== catalog.demoId);
    const deployments = wave(ctx, promotion, 1);
    if (deployments.length === 0) return later(ctx, promotion);
    promotion.state = 'rolling_out';
    promotion.wave = 1;
    return {
      kind: 'promotion.approve',
      promotionId: promotion.id,
      approverId: approvers.length > 0 ? rng.pick(approvers) : null,
      deployments,
    };
  }
  if (promotion.outcome === 'rolled_back') {
    return finish('rolled_back', 'The canary rolled back, so the other regions were not touched');
  }
  if (promotion.outcome === 'failed') return finish('failed', 'A deploy failed');
  const waves = prodEnvs(catalog).length > 1 ? 2 : 1;
  if (promotion.wave < waves) {
    const deployments = wave(ctx, promotion, promotion.wave + 1);
    if (deployments.length === 0) return later(ctx, promotion);
    promotion.wave += 1;
    return { kind: 'promotion.wave', promotionId: promotion.id, wave: promotion.wave, deployments };
  }
  return finish('succeeded', `${promotion.version} is live in every region`);
}
